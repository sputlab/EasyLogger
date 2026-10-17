<?php
declare(strict_types=1);
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/inc/sync.php';

/* ==========================================================
   EasyLogger API — versione in config/app.php (APP_VERSION)
   Errori: {"error":"<codice>"} — il client traduce il codice.
   Sincronizzazione (4.0): push (coda di modifiche) + sync (delta per revisione)
   → vedi inc/sync.php
   Richiede PHP >= 8.0
========================================================== */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header('Cache-Control: no-store');

/* Sessione: resta valida fino a 12 ore di inattività (i timer possono restare aperti a lungo) */
ini_set('session.gc_maxlifetime', (string)(12 * 3600));
ini_set('session.use_strict_mode', '1');
session_name('EASYLOGGERSID');
session_set_cookie_params([
  'lifetime' => 0,
  'path'     => rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/') . '/',
  'httponly' => true,
  'samesite' => 'Strict',
  'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
]);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));

/** Errore "previsto": il codice viene restituito al client e tradotto lì. */
final class AppError extends Exception {
  public string $key;
  public int $http;
  public function __construct(string $key, int $http = 400) {
    parent::__construct($key);
    $this->key  = $key;
    $this->http = $http;
  }
}

$action = (string)($_GET['action'] ?? '');

/* Azioni pubbliche (non richiedono login) */
$public = ['login', 'register', 'check', 'request_reset', 'reset_password'];
/* Azioni di sola lettura (GET ammesso, nessun CSRF) */
$readOnly = ['check', 'sync', 'get_stats'];

try {
  if (!in_array($action, $public, true) && empty($_SESSION['user_id'])) {
    throw new AppError('not_authenticated', 401);
  }
  if (!in_array($action, $readOnly, true) && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    throw new AppError('method_not_allowed', 405);
  }

  match ($action) {
    'login'           => login(),
    'register'        => registerUser(),
    'logout'          => logout(),
    'check'           => check(),
    'request_reset'   => requestReset(),
    'reset_password'  => resetPassword(),
    'sync'            => syncPull(),
    'push'            => syncPush(),
    'clear_list'      => clearList(),
    'get_stats'       => getStats(),
    'reset_stats'     => resetStats(),
    'update_profile'  => updateProfile(),
    'delete_account'  => deleteAccount(),
    default           => throw new AppError('invalid_action'),
  };
} catch (AppError $e) {
  // Nel log solo gli eventi utili (sicurezza / anomalie), non i normali errori di validazione
  if (in_array($e->key, ['csrf_invalid', 'too_many_attempts', 'token_invalid', 'method_not_allowed', 'invalid_action', 'payload_too_large'], true)) {
    logError($action . ': ' . $e->key);
  }
  http_response_code($e->http);
  echo json_encode(['error' => $e->key]);
} catch (Throwable $e) {
  // Dettagli tecnici (SQL, path…) solo nel log, mai al client
  logError($action . ': ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . basename($e->getFile()) . ':' . $e->getLine());
  http_response_code(500);
  echo json_encode(['error' => 'server_error']);
}

/* ─────────────────────────── Helpers ─────────────────────────── */
function body(): array {
  static $b = null;
  if ($b !== null) return $b;
  $raw = file_get_contents('php://input') ?: '';
  $data = json_decode($raw, true);
  if (!is_array($data)) $data = [];
  if (!hash_equals((string)($_SESSION['csrf'] ?? ''), (string)($data['csrf'] ?? ''))) {
    throw new AppError('csrf_invalid', 403);
  }
  return $b = $data;
}
function ok($d = null): void { echo json_encode(['ok' => true, 'data' => $d]); }
function uid(): int { return (int)$_SESSION['user_id']; }
function str(array $b, string $k, int $max = 1000): string {
  $v = $b[$k] ?? '';
  if (!is_string($v)) $v = is_scalar($v) ? (string)$v : '';
  return mb_substr(trim($v), 0, $max);
}
function clientIp(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45); }

function logError(string $msg): void {
  $file = __DIR__ . '/logs/errors.log';
  // Rotazione semplice: oltre 1 MB il log viene archiviato in errors.log.1
  if (is_file($file) && filesize($file) > 1048576) @rename($file, $file . '.1');
  @file_put_contents($file, '[' . date('Y-m-d H:i:s') . '] ' . clientIp() . ' ' . $msg . "\n", FILE_APPEND | LOCK_EX);
}

/** Rate limit per IP persistente su DB (non aggirabile cancellando i cookie). */
function rateLimit(string $bucket, int $max, int $windowSec): void {
  $db = getDB();
  $ip = clientIp();
  $st = $db->prepare('SELECT COUNT(*) FROM ' . TBL_RATE_LIMITS . ' WHERE bucket=? AND ip=? AND created_at > (NOW() - INTERVAL ? SECOND)');
  $st->execute([$bucket, $ip, $windowSec]);
  if ((int)$st->fetchColumn() >= $max) throw new AppError('too_many_attempts', 429);
  $db->prepare('INSERT INTO ' . TBL_RATE_LIMITS . ' (bucket, ip) VALUES (?, ?)')->execute([$bucket, $ip]);
  // Pulizia occasionale delle righe vecchie
  if (random_int(1, 50) === 1) $db->exec('DELETE FROM ' . TBL_RATE_LIMITS . ' WHERE created_at < (NOW() - INTERVAL 1 DAY)');
}
function clearRateLimit(string $bucket): void {
  getDB()->prepare('DELETE FROM ' . TBL_RATE_LIMITS . ' WHERE bucket=? AND ip=?')->execute([$bucket, clientIp()]);
}

function validUsername(string $u): bool {
  $len = mb_strlen($u);
  return $len >= USERNAME_MIN && $len <= USERNAME_MAX && preg_match('/^[\p{L}\p{N}_.\-]+$/u', $u) === 1;
}
function validLang(string $l): string { return in_array($l, ['it', 'en'], true) ? $l : 'it'; }

/** Valida l'array delle sessioni di un'attività e ricalcola il totale lato server. */
function cleanSessions($sessions): array {
  if (!is_array($sessions)) return [[], 0];
  $re = '/^([01]\d|2[0-3]):[0-5]\d$/';
  $out = []; $total = 0;
  foreach (array_slice($sessions, 0, 500) as $s) {
    if (!is_array($s)) continue;
    $start = (is_string($s['start'] ?? null) && preg_match($re, $s['start'])) ? $s['start'] : '';
    $end   = (is_string($s['end'] ?? null)   && preg_match($re, $s['end']))   ? $s['end']   : '';
    $sec   = max(0, min(86400, (int)($s['seconds'] ?? 0)));
    $out[] = ['start' => $start, 'end' => $end, 'seconds' => $sec];
    $total += $sec;
  }
  return [$out, $total];
}

function userPayload(int $id, string $username, string $lang): array {
  return ['user_id' => $id, 'username' => $username, 'lang' => $lang, 'csrf' => $_SESSION['csrf']];
}

/* ─────────────────────────── Auth ─────────────────────────── */
function login(): void {
  $b = body();
  $username = str($b, 'username', 60);
  $password = (string)($b['password'] ?? '');
  if ($username === '' || $password === '') throw new AppError('fields_required');

  rateLimit('login', 10, 900);

  $st = getDB()->prepare('SELECT id, username, password, lang FROM ' . TBL_USERS . ' WHERE username=?');
  $st->execute([$username]);
  $u = $st->fetch();
  if (!$u || !password_verify($password, $u['password'])) throw new AppError('invalid_credentials', 401);

  // Aggiorna l'hash se l'algoritmo/costo di default è cambiato
  if (password_needs_rehash($u['password'], PASSWORD_DEFAULT)) {
    getDB()->prepare('UPDATE ' . TBL_USERS . ' SET password=? WHERE id=?')
      ->execute([password_hash($password, PASSWORD_DEFAULT), $u['id']]);
  }

  clearRateLimit('login');
  session_regenerate_id(true);
  $_SESSION['user_id']  = (int)$u['id'];
  $_SESSION['username'] = $u['username'];
  ok(userPayload((int)$u['id'], $u['username'], $u['lang'] ?? 'it'));
}

function registerUser(): void {
  $b = body();
  $username = str($b, 'username', 60);
  $password = (string)($b['password'] ?? '');
  $lang     = validLang(str($b, 'lang', 5));
  if (!validUsername($username)) throw new AppError('username_invalid');
  if (mb_strlen($password) < PASSWORD_MIN) throw new AppError('password_too_short');

  rateLimit('register', 5, 3600);

  $db = getDB();
  $st = $db->prepare('SELECT id FROM ' . TBL_USERS . ' WHERE username=?');
  $st->execute([$username]);
  if ($st->fetch()) throw new AppError('username_taken');

  $db->prepare('INSERT INTO ' . TBL_USERS . ' (username, password, lang) VALUES (?, ?, ?)')
     ->execute([$username, password_hash($password, PASSWORD_DEFAULT), $lang]);
  $id = (int)$db->lastInsertId();

  session_regenerate_id(true);
  $_SESSION['user_id']  = $id;
  $_SESSION['username'] = $username;
  ok(userPayload($id, $username, $lang));
}

function logout(): void {
  body();
  // 3.3.0: il logout NON nasconde più le attività. In 3.1/3.2 impostava list_cleared_at=NOW()
  // a livello di utente, quindi un logout su qualsiasi device faceva "sparire" le attività
  // (che erano comunque salvate nel DB) su tutti i device.
  endSession();
  ok();
}

function endSession(): void {
  $_SESSION = [];
  $p = session_get_cookie_params();
  setcookie(session_name(), '', [
    'expires' => time() - 3600, 'path' => $p['path'],
    'secure' => $p['secure'], 'httponly' => $p['httponly'], 'samesite' => $p['samesite'],
  ]);
  session_destroy();
}

function check(): void {
  $lang = null;
  if (!empty($_SESSION['user_id'])) {
    $st = getDB()->prepare('SELECT username, lang FROM ' . TBL_USERS . ' WHERE id=?');
    $st->execute([uid()]);
    $u = $st->fetch();
    if (!$u) { // utente eliminato da un'altra sessione
      $_SESSION = ['csrf' => bin2hex(random_bytes(32))];
    } else {
      $_SESSION['username'] = $u['username'];
      $lang = $u['lang'];
    }
  }
  ok([
    'logged_in' => !empty($_SESSION['user_id']),
    'user_id'   => $_SESSION['user_id'] ?? null,
    'username'  => $_SESSION['username'] ?? null,
    'lang'      => $lang,
    'csrf'      => $_SESSION['csrf'],
    'version'   => APP_VERSION,
  ]);
}

/* ─────────────────────────── Password reset ───────────────────────────
   L'app non gestisce email: la richiesta genera un token che l'amministratore
   recupera dal DB e invia all'utente come link reset.php?token=…  (vedi README) */
function requestReset(): void {
  $b = body();
  $username = str($b, 'username', 60);
  rateLimit('reset', 5, 3600);
  if ($username === '') throw new AppError('fields_required');

  $db = getDB();
  $st = $db->prepare('SELECT id FROM ' . TBL_USERS . ' WHERE username=?');
  $st->execute([$username]);
  $u = $st->fetch();
  if (!$u) { ok(); return; }  // risposta identica: non rivela se l'utente esiste

  $db->prepare('UPDATE ' . TBL_RESETS . ' SET used=1 WHERE user_id=? AND used=0')->execute([$u['id']]);
  $db->prepare('INSERT INTO ' . TBL_RESETS . ' (user_id, token, expires_at) VALUES (?, ?, NOW() + INTERVAL 24 HOUR)')
     ->execute([$u['id'], bin2hex(random_bytes(32))]);
  ok();
}

function resetPassword(): void {
  $b = body();
  $token    = str($b, 'token', 64);
  $password = (string)($b['password'] ?? '');
  if (mb_strlen($password) < PASSWORD_MIN) throw new AppError('password_too_short');
  rateLimit('reset_pw', 10, 3600);

  $db = getDB();
  $st = $db->prepare(
    'SELECT r.id rid, u.id uid FROM ' . TBL_RESETS . ' r
     JOIN ' . TBL_USERS . ' u ON u.id = r.user_id
     WHERE r.token=? AND r.used=0 AND r.expires_at > NOW()'
  );
  $st->execute([$token]);
  $r = $st->fetch();
  if (!$r) throw new AppError('token_invalid');

  $db->beginTransaction();
  $db->prepare('UPDATE ' . TBL_USERS . ' SET password=? WHERE id=?')
     ->execute([password_hash($password, PASSWORD_DEFAULT), $r['uid']]);
  $db->prepare('UPDATE ' . TBL_RESETS . ' SET used=1 WHERE user_id=?')->execute([$r['uid']]);
  $db->commit();
  ok();
}

/* ─────────────────────────── Stats ─────────────────────────── */
function getStats(): void {
  $db = getDB();
  $st = $db->prepare('SELECT username, created_at, stats_reset_at FROM ' . TBL_USERS . ' WHERE id=?');
  $st->execute([uid()]);
  $u = $st->fetch() ?: [];
  $since = ($u['stats_reset_at'] ?? null) ?: '1970-01-01 00:00:00';

  $st = $db->prepare('SELECT COUNT(*) c, COALESCE(SUM(total_seconds),0) s FROM ' . TBL_ACTIVITIES . ' WHERE user_id=? AND created_at > ? AND deleted_at IS NULL');
  $st->execute([uid(), $since]);
  $r = $st->fetch();

  $cats = $db->prepare(
    'SELECT category_text AS category, COUNT(*) cnt, COALESCE(SUM(total_seconds),0) sec
     FROM ' . TBL_ACTIVITIES . ' WHERE user_id=? AND created_at > ? AND deleted_at IS NULL
     GROUP BY category_text ORDER BY sec DESC'
  );
  $cats->execute([uid(), $since]);
  $byCategory = array_map(
    fn($c) => ['category' => $c['category'], 'cnt' => (int)$c['cnt'], 'sec' => (int)$c['sec']],
    $cats->fetchAll()
  );

  ok([
    'username'         => $u['username'] ?? null,
    'total_activities' => (int)$r['c'],
    'total_seconds'    => (int)$r['s'],
    'by_category'      => $byCategory,
    'member_since'     => $u['created_at'] ?? null,
    'stats_since'      => $u['stats_reset_at'] ?? null,
  ]);
}

function resetStats(): void {
  body();
  getDB()->prepare('UPDATE ' . TBL_USERS . ' SET stats_reset_at=NOW() WHERE id=?')->execute([uid()]);
  ok();
}

/* ─────────────────────────── Profile ─────────────────────────── */
function updateProfile(): void {
  $b = body();
  $db = getDB();
  $type = (string)($b['type'] ?? '');

  if ($type === 'username') {
    $new = str($b, 'username', 60);
    if (!validUsername($new)) throw new AppError('username_invalid');
    $st = $db->prepare('SELECT id FROM ' . TBL_USERS . ' WHERE username=? AND id<>?');
    $st->execute([$new, uid()]);
    if ($st->fetch()) throw new AppError('username_taken');
    $db->prepare('UPDATE ' . TBL_USERS . ' SET username=? WHERE id=?')->execute([$new, uid()]);
    $_SESSION['username'] = $new;
    ok(['username' => $new]);

  } elseif ($type === 'password') {
    $old = (string)($b['old_password'] ?? '');
    $new = (string)($b['new_password'] ?? '');
    if (mb_strlen($new) < PASSWORD_MIN) throw new AppError('password_too_short');
    rateLimit('pw_change', 10, 900);
    $st = $db->prepare('SELECT password FROM ' . TBL_USERS . ' WHERE id=?');
    $st->execute([uid()]);
    $hash = $st->fetchColumn();
    if (!$hash || !password_verify($old, $hash)) throw new AppError('old_password_wrong');
    $db->prepare('UPDATE ' . TBL_USERS . ' SET password=? WHERE id=?')->execute([password_hash($new, PASSWORD_DEFAULT), uid()]);
    session_regenerate_id(true);
    ok();

  } elseif ($type === 'lang') {
    $lang = validLang(str($b, 'lang', 5));
    $db->prepare('UPDATE ' . TBL_USERS . ' SET lang=? WHERE id=?')->execute([$lang, uid()]);
    ok(['lang' => $lang]);

  } else {
    throw new AppError('invalid_type');
  }
}

function deleteAccount(): void {
  $b = body();
  rateLimit('pw_change', 10, 900);
  $db = getDB();
  $st = $db->prepare('SELECT password FROM ' . TBL_USERS . ' WHERE id=?');
  $st->execute([uid()]);
  $hash = $st->fetchColumn();
  if (!$hash || !password_verify((string)($b['password'] ?? ''), $hash)) throw new AppError('password_wrong');
  // Le FK ON DELETE CASCADE rimuovono attività, etichette, timer e token
  $db->prepare('DELETE FROM ' . TBL_USERS . ' WHERE id=?')->execute([uid()]);
  endSession();
  ok();
}
