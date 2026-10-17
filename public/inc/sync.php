<?php
declare(strict_types=1);

/* ==========================================================
   EasyLogger 4 — Motore di sincronizzazione

   Modello:
   • Ogni utente ha un contatore di revisione monotono (users.rev).
     Ogni scrittura prende la revisione successiva DENTRO una transazione
     (il lock sulla riga utente serializza le scritture dello stesso utente),
     quindi "rev > since" non perde mai modifiche.
   • Attività e timer hanno un uid generato dal client (idempotenza: un
     invio ripetuto non crea duplicati), una version (controllo di
     concorrenza ottimistico) e una cancellazione "soft" (deleted_at).
   • push: il client invia le modifiche in coda; per ogni operazione il
     server risponde ok / conflict (con il record attuale) / gone / invalid.
   • sync?since=N: restituisce solo ciò che è cambiato dopo la revisione N
     (oppure tutto, se N=0 o se i tombstone più vecchi sono stati eliminati).
========================================================== */

const UID_RE = '/^[A-Za-z0-9_\-]{3,64}$/';

/* ───────────── Date: il DB lavora nel suo fuso, al client si danno ISO 8601 ───────────── */
function dbTz(): DateTimeZone {
  static $tz = null;
  if ($tz === null) {
    $min = (int)getDB()->query('SELECT TIMESTAMPDIFF(MINUTE, UTC_TIMESTAMP(), NOW())')->fetchColumn();
    $sign = $min < 0 ? '-' : '+';
    $min = abs($min);
    $tz = new DateTimeZone(sprintf('%s%02d:%02d', $sign, intdiv($min, 60), $min % 60));
  }
  return $tz;
}
function toIso(?string $dbDate): ?string {
  if (!$dbDate) return null;
  return (new DateTime($dbDate, dbTz()))->format('Y-m-d\TH:i:s.vP');
}
/** ISO del client → DATETIME del DB; null se non valida o nel futuro (> 1 giorno). */
function fromIso($iso): ?string {
  if (!is_string($iso) || $iso === '' || strlen($iso) > 40) return null;
  try { $d = new DateTime($iso); } catch (Throwable $e) { return null; }
  if ($d->getTimestamp() > time() + 86400 || $d->getTimestamp() < 946684800) return null;
  return $d->setTimezone(dbTz())->format('Y-m-d H:i:s');
}

/** Revisione successiva per l'utente corrente (va chiamata dentro una transazione). */
function nextRev(PDO $db): int {
  $db->prepare('UPDATE ' . TBL_USERS . ' SET rev = LAST_INSERT_ID(rev + 1) WHERE id=?')->execute([uid()]);
  return (int)$db->lastInsertId();
}

/* ───────────── Normalizzazione dei dati in ingresso ───────────── */
function normActivity(array $d): array {
  [$sessions, $total] = cleanSessions($d['sessions'] ?? []);
  $category = str($d, 'category', 40) ?: 'altro';
  return [
    'description'   => str($d, 'description', 5000),
    'category'      => $category,
    'category_text' => str($d, 'category_text', 60) ?: $category,
    'sessions'      => $sessions,
    'total_seconds' => $total,
  ];
}
function normTimer(array $d): array {
  [$sessions] = cleanSessions($d['live_sessions'] ?? []);
  $state = in_array($d['state'] ?? '', ['idle', 'running', 'paused'], true) ? $d['state'] : 'idle';
  $start = isset($d['session_start']) && is_numeric($d['session_start']) ? (int)$d['session_start'] : null;
  if ($state !== 'running') $start = null;
  if ($state === 'running' && !$start) $state = 'paused';
  return [
    'position'      => max(0, min(1000000, (int)($d['position'] ?? 0))),
    'state'         => $state,
    'session_start' => $start,
    'accumulated_s' => max(0, min(10 * 86400, (int)($d['accumulated_s'] ?? 0))),
    'live_sessions' => $sessions,
    'description'   => str($d, 'description', 5000),
    'category'      => str($d, 'category', 40) ?: 'altro',
  ];
}

/* ───────────── Record → formato client ───────────── */
function actOut(array $r): array {
  if ($r['deleted_at']) return ['uid' => $r['uid'], 'deleted' => true, 'version' => (int)$r['version']];
  return [
    'uid'           => $r['uid'],
    'version'       => (int)$r['version'],
    'description'   => $r['description'],
    'category'      => $r['category'],
    'category_text' => $r['category_text'],
    'sessions'      => json_decode((string)$r['sessions'], true) ?? [],
    'total_seconds' => (int)$r['total_seconds'],
    'created_at'    => toIso($r['created_at']),
  ];
}
function timerOut(array $r): array {
  if ($r['deleted_at']) return ['uid' => $r['uid'], 'deleted' => true, 'version' => (int)$r['version']];
  return [
    'uid'           => $r['uid'],
    'version'       => (int)$r['version'],
    'position'      => (int)$r['position'],
    'state'         => $r['state'],
    'session_start' => $r['session_start'] !== null ? (int)$r['session_start'] : null,
    'accumulated_s' => (int)$r['accumulated_s'],
    'live_sessions' => json_decode((string)$r['live_sessions'], true) ?? [],
    'description'   => $r['description'],
    'category'      => $r['category'],
  ];
}

/* ───────────── PUSH ───────────── */
function syncPush(): void {
  $b = body();
  $ops = $b['ops'] ?? null;
  if (!is_array($ops)) throw new AppError('invalid_type');
  if (count($ops) > SYNC_MAX_OPS) throw new AppError('payload_too_large', 413);

  ensureTimersMigrated();
  $results = [];
  foreach (array_values($ops) as $op) {
    if (!is_array($op)) { $results[] = ['status' => 'invalid']; continue; }
    $type = (string)($op['type'] ?? '');
    try {
      $results[] = match ($type) {
        'activity' => pushActivity($op),
        'timer'    => pushTimer($op),
        'labels'   => pushLabels($op),
        default    => ['type' => $type, 'status' => 'invalid'],
      };
    } catch (AppError $e) {
      if (getDB()->inTransaction()) getDB()->rollBack();
      $results[] = ['type' => $type, 'uid' => (string)($op['uid'] ?? ''), 'status' => 'invalid', 'error' => $e->key];
    }
  }
  $st = getDB()->prepare('SELECT rev FROM ' . TBL_USERS . ' WHERE id=?');
  $st->execute([uid()]);
  ok(['results' => $results, 'rev' => (int)$st->fetchColumn()]);
}

function pushActivity(array $op): array {
  $uidStr = (string)($op['uid'] ?? '');
  if (!preg_match(UID_RE, $uidStr)) throw new AppError('invalid_type');
  $base = max(0, (int)($op['base_version'] ?? 0));
  $res  = ['type' => 'activity', 'uid' => $uidStr];

  $db = getDB();
  $db->beginTransaction();
  $rev = nextRev($db);
  $st = $db->prepare('SELECT * FROM ' . TBL_ACTIVITIES . ' WHERE user_id=? AND uid=? FOR UPDATE');
  $st->execute([uid(), $uidStr]);
  $row = $st->fetch();

  // Eliminazione: vince sempre (è una scelta esplicita dell'utente) ed è idempotente
  if (!empty($op['deleted'])) {
    if ($row && !$row['deleted_at']) {
      $db->prepare('UPDATE ' . TBL_ACTIVITIES . ' SET deleted_at=NOW(), version=version+1, rev=? WHERE id=?')->execute([$rev, $row['id']]);
    }
    $db->commit();
    return $res + ['status' => 'ok', 'version' => $row ? (int)$row['version'] + 1 : 0];
  }

  $data = is_array($op['data'] ?? null) ? $op['data'] : [];
  $d = normActivity($data);
  $sessionsJson = json_encode($d['sessions']);

  if (!$row) {
    $created = fromIso($data['created_at'] ?? null) ?? date_create('now', dbTz())->format('Y-m-d H:i:s');
    $db->prepare(
      'INSERT INTO ' . TBL_ACTIVITIES . ' (user_id, uid, timer_id, description, category, category_text, total_seconds, sessions, created_at, version, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
    )->execute([uid(), $uidStr, str($data, 'timer_id', 64), $d['description'], $d['category'], $d['category_text'],
                $d['total_seconds'], $sessionsJson, $created, $rev]);
    $db->commit();
    return $res + ['status' => 'ok', 'version' => 1];
  }

  if ($row['deleted_at']) { $db->commit(); return $res + ['status' => 'gone']; }

  $same = $row['description'] === $d['description'] && $row['category'] === $d['category']
       && $row['category_text'] === $d['category_text']
       && (json_decode((string)$row['sessions'], true) ?? []) == $d['sessions'];

  if ((int)$row['version'] === $base || $same) {
    if (!$same) {
      $db->prepare(
        'UPDATE ' . TBL_ACTIVITIES . ' SET description=?, category=?, category_text=?, total_seconds=?, sessions=?, version=version+1, rev=? WHERE id=?'
      )->execute([$d['description'], $d['category'], $d['category_text'], $d['total_seconds'], $sessionsJson, $rev, $row['id']]);
      $db->commit();
      return $res + ['status' => 'ok', 'version' => (int)$row['version'] + 1];
    }
    $db->commit(); // invio ripetuto / nessuna modifica: idempotente
    return $res + ['status' => 'ok', 'version' => (int)$row['version']];
  }

  $db->commit();
  return $res + ['status' => 'conflict', 'record' => actOut($row)];
}

function pushTimer(array $op): array {
  $uidStr = (string)($op['uid'] ?? '');
  if (!preg_match(UID_RE, $uidStr)) throw new AppError('invalid_type');
  $base = max(0, (int)($op['base_version'] ?? 0));
  $res  = ['type' => 'timer', 'uid' => $uidStr];

  $db = getDB();
  $db->beginTransaction();
  $rev = nextRev($db);
  $st = $db->prepare('SELECT * FROM ' . TBL_TIMERS . ' WHERE user_id=? AND uid=? FOR UPDATE');
  $st->execute([uid(), $uidStr]);
  $row = $st->fetch();

  if (!empty($op['deleted'])) {
    if ($row && !$row['deleted_at']) {
      $db->prepare('UPDATE ' . TBL_TIMERS . ' SET deleted_at=NOW(), version=version+1, rev=? WHERE id=?')->execute([$rev, $row['id']]);
    }
    $db->commit();
    return $res + ['status' => 'ok', 'version' => $row ? (int)$row['version'] + 1 : 0];
  }

  $d = normTimer(is_array($op['data'] ?? null) ? $op['data'] : []);
  $vals = [$d['position'], $d['state'], $d['session_start'], $d['accumulated_s'], json_encode($d['live_sessions']), $d['description'], $d['category']];

  if (!$row) {
    $cnt = $db->prepare('SELECT COUNT(*) FROM ' . TBL_TIMERS . ' WHERE user_id=? AND deleted_at IS NULL');
    $cnt->execute([uid()]);
    if ((int)$cnt->fetchColumn() >= 50) { $db->rollBack(); throw new AppError('payload_too_large', 413); }
    $db->prepare(
      'INSERT INTO ' . TBL_TIMERS . ' (user_id, uid, position, state, session_start, accumulated_s, live_sessions, description, category, version, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
    )->execute(array_merge([uid(), $uidStr], $vals, [$rev]));
    $db->commit();
    return $res + ['status' => 'ok', 'version' => 1];
  }

  if ($row['deleted_at']) { $db->commit(); return $res + ['status' => 'gone']; }

  $cur = normTimer(timerOut($row));
  $same = $cur == $d;

  if ((int)$row['version'] === $base || $same) {
    if (!$same) {
      $db->prepare(
        'UPDATE ' . TBL_TIMERS . ' SET position=?, state=?, session_start=?, accumulated_s=?, live_sessions=?, description=?, category=?, version=version+1, rev=? WHERE id=?'
      )->execute(array_merge($vals, [$rev, $row['id']]));
      $db->commit();
      return $res + ['status' => 'ok', 'version' => (int)$row['version'] + 1];
    }
    $db->commit();
    return $res + ['status' => 'ok', 'version' => (int)$row['version']];
  }

  $db->commit();
  return $res + ['status' => 'conflict', 'record' => timerOut($row)];
}

function pushLabels(array $op): array {
  $labels = is_array($op['labels'] ?? null) ? array_slice($op['labels'], 0, 50) : [];
  $colorRe = '/^(#[0-9a-fA-F]{3,8}|var\(--[a-z0-9\-]+\))$/';
  $clean = []; $seen = [];
  foreach ($labels as $l) {
    if (!is_array($l)) continue;
    $id = str($l, 'id', 40);
    if (!preg_match('/^[A-Za-z0-9_\-]+$/', $id) || isset($seen[$id])) continue;
    $seen[$id] = true;
    $bg = str($l, 'bg', 40); $color = str($l, 'color', 40);
    $clean[] = [$id, str($l, 'text', 60) ?: $id,
      preg_match($colorRe, $bg) ? $bg : '#e0dbd3', preg_match($colorRe, $color) ? $color : '#1a1714'];
  }
  if (!$clean) throw new AppError('label_required');

  $db = getDB();
  $db->beginTransaction();
  $rev = nextRev($db);
  $db->prepare('DELETE FROM ' . TBL_LABELS . ' WHERE user_id=?')->execute([uid()]);
  $ins = $db->prepare('INSERT INTO ' . TBL_LABELS . ' (user_id, label_id, label_text, bg, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
  foreach ($clean as $i => $l) $ins->execute([uid(), $l[0], $l[1], $l[2], $l[3], $i]);
  $db->prepare('UPDATE ' . TBL_USERS . ' SET labels_rev=? WHERE id=?')->execute([$rev, uid()]);
  $db->commit();
  return ['type' => 'labels', 'status' => 'ok'];
}

/* ───────────── PULL ───────────── */
function syncPull(): void {
  ensureTimersMigrated();
  maybePurgeTombstones();
  $since = max(0, (int)($_GET['since'] ?? 0));

  $db = getDB();
  // Snapshot consistente: la revisione letta corrisponde esattamente ai dati letti
  $db->exec('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  $st = $db->prepare('SELECT rev, labels_rev, purged_rev, list_cleared_at FROM ' . TBL_USERS . ' WHERE id=?');
  $st->execute([uid()]);
  $u = $st->fetch();
  if (!$u) { $db->rollBack(); throw new AppError('not_authenticated', 401); }

  $full = $since === 0 || $since < (int)$u['purged_rev'] || $since > (int)$u['rev'];
  $cleared = $u['list_cleared_at'] ?: '1970-01-01 00:00:00';

  if ($full) {
    $a = $db->prepare('SELECT * FROM ' . TBL_ACTIVITIES . ' WHERE user_id=? AND deleted_at IS NULL AND created_at > ?
                       ORDER BY created_at DESC, id DESC LIMIT ' . SYNC_FULL_LIMIT);
    $a->execute([uid(), $cleared]);
    $t = $db->prepare('SELECT * FROM ' . TBL_TIMERS . ' WHERE user_id=? AND deleted_at IS NULL ORDER BY position, id');
    $t->execute([uid()]);
  } else {
    $a = $db->prepare('SELECT * FROM ' . TBL_ACTIVITIES . ' WHERE user_id=? AND rev > ? ORDER BY rev');
    $a->execute([uid(), $since]);
    $t = $db->prepare('SELECT * FROM ' . TBL_TIMERS . ' WHERE user_id=? AND rev > ? ORDER BY rev');
    $t->execute([uid(), $since]);
  }
  $acts   = array_map('actOut', $a->fetchAll());
  $timers = array_map('timerOut', $t->fetchAll());

  $labels = null;
  if ($full || (int)$u['labels_rev'] > $since) {
    $l = $db->prepare('SELECT label_id, label_text, bg, color FROM ' . TBL_LABELS . ' WHERE user_id=? ORDER BY sort_order');
    $l->execute([uid()]);
    $labels = array_map(fn($r) => ['id' => $r['label_id'], 'text' => $r['label_text'], 'bg' => $r['bg'], 'color' => $r['color']], $l->fetchAll());
  }
  $db->commit();

  ok([
    'rev'             => (int)$u['rev'],
    'full'            => $full,
    'list_cleared_at' => $u['list_cleared_at'] ? toIso($u['list_cleared_at']) : null,
    'activities'      => $acts,
    'timers'          => $timers,
    'labels'          => $labels,
  ]);
}

/** "Reset lista": nasconde le attività correnti su tutti i device (restano nel DB e nelle statistiche). */
function clearList(): void {
  body();
  $db = getDB();
  $db->beginTransaction();
  nextRev($db);
  $db->prepare('UPDATE ' . TBL_USERS . ' SET list_cleared_at=NOW() WHERE id=?')->execute([uid()]);
  $st = $db->prepare('SELECT list_cleared_at FROM ' . TBL_USERS . ' WHERE id=?');
  $st->execute([uid()]);
  $db->commit();
  ok(['list_cleared_at' => toIso($st->fetchColumn())]);
}

/* ───────────── Manutenzione ───────────── */

/** Converte (una sola volta per utente) il vecchio blob JSON dei timer 3.x in record singoli. */
function ensureTimersMigrated(): void {
  $db = getDB();
  $st = $db->prepare('SELECT timers_migrated FROM ' . TBL_USERS . ' WHERE id=?');
  $st->execute([uid()]);
  if ((int)$st->fetchColumn() === 1) return;

  $db->beginTransaction();
  $lock = $db->prepare('SELECT timers_migrated FROM ' . TBL_USERS . ' WHERE id=? FOR UPDATE');
  $lock->execute([uid()]);
  if ((int)$lock->fetchColumn() === 1) { $db->commit(); return; }

  $blob = null;
  try {
    $o = $db->prepare('SELECT timer_data FROM ' . TBL_TIMERS_OLD . ' WHERE user_id=?');
    $o->execute([uid()]);
    $blob = $o->fetchColumn();
  } catch (PDOException $e) { /* tabella 3.x assente: nuova installazione */ }

  $data = $blob ? json_decode((string)$blob, true) : null;
  if (is_array($data)) {
    $map   = (isset($data['timers']) && is_array($data['timers'])) ? $data['timers'] : $data;
    $order = (isset($data['order']) && is_array($data['order'])) ? $data['order'] : array_keys($map);
    foreach (array_keys($map) as $k) if (!in_array($k, $order, true)) $order[] = $k;
    $pos = 0;
    $rev = nextRev($db);
    $ins = $db->prepare(
      'INSERT IGNORE INTO ' . TBL_TIMERS . ' (user_id, uid, position, state, session_start, accumulated_s, live_sessions, description, category, version, rev)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
    );
    foreach ($order as $tid) {
      $ts = $map[$tid] ?? null;
      if (!is_array($ts) || !preg_match(UID_RE, (string)$tid)) continue;
      $startMs = null;
      if (!empty($ts['sessionStart'])) { $t = strtotime((string)$ts['sessionStart']); if ($t) $startMs = $t * 1000; }
      $d = normTimer([
        'position' => $pos++, 'state' => $ts['state'] ?? 'idle', 'session_start' => $startMs,
        'accumulated_s' => $ts['accumulatedS'] ?? 0, 'live_sessions' => $ts['liveSessions'] ?? [],
        'description' => $ts['description'] ?? '', 'category' => $ts['category'] ?? 'altro',
      ]);
      $ins->execute([uid(), (string)$tid, $d['position'], $d['state'], $d['session_start'], $d['accumulated_s'],
                     json_encode($d['live_sessions']), $d['description'], $d['category'], $rev]);
    }
  }
  $db->prepare('UPDATE ' . TBL_USERS . ' SET timers_migrated=1 WHERE id=?')->execute([uid()]);
  $db->commit();
}

/** Elimina fisicamente i record cancellati da più di TOMBSTONE_KEEP_DAYS giorni (1 volta su 50). */
function maybePurgeTombstones(): void {
  if (random_int(1, 50) !== 1) return;
  $db = getDB();
  $db->beginTransaction();
  $st = $db->prepare('SELECT rev FROM ' . TBL_USERS . ' WHERE id=? FOR UPDATE');
  $st->execute([uid()]);
  $rev = (int)$st->fetchColumn();
  $n = 0;
  foreach ([TBL_ACTIVITIES, TBL_TIMERS] as $tbl) {
    $d = $db->prepare('DELETE FROM ' . $tbl . ' WHERE user_id=? AND deleted_at IS NOT NULL AND deleted_at < (NOW() - INTERVAL ' . TOMBSTONE_KEEP_DAYS . ' DAY)');
    $d->execute([uid()]);
    $n += $d->rowCount();
  }
  // I device che non si sincronizzano da prima di questa revisione faranno una sync completa
  if ($n > 0) $db->prepare('UPDATE ' . TBL_USERS . ' SET purged_rev=? WHERE id=?')->execute([$rev, uid()]);
  $db->commit();
}
