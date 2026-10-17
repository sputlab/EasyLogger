// ═══════════════════════════════════════════════════════════════
//  EasyLogger 4 — JavaScript principale
//  Versione: config/app.php (APP_VERSION) → window.APP_VERSION
//
//  Architettura "local-first":
//  • Tutti i dati (attività, timer, etichette) vivono in uno store locale
//    persistito nel localStorage, uno per utente (+ uno per l'ospite).
//  • Ogni modifica viene applicata subito in locale e marcata "dirty":
//    l'app funziona anche offline e non perde mai un salvataggio.
//  • Il motore di sync invia le modifiche in coda (push, idempotente grazie
//    agli uid generati dal client) e scarica solo i cambiamenti successivi
//    all'ultima revisione vista (pull incrementale).
//  • Conflitti (stesso timer/attività modificato su due device): vince il
//    server, il device si riallinea e avvisa l'utente.
// ═══════════════════════════════════════════════════════════════
'use strict';

const API = 'api.php';
const STORE_VERSION = 4;
const SYNC_INTERVAL_MS = 30 * 1000;

/* Etichette predefinite: il testo arriva dalle traduzioni (label.<id>) */
const DEFAULT_LABEL_DEFS = [
  { id:'lavoro',   bg:'var(--blue-light)',   color:'var(--blue)'       },
  { id:'sviluppo', bg:'var(--green-light)',  color:'var(--green)'      },
  { id:'riunione', bg:'var(--yellow-light)', color:'var(--yellow)'     },
  { id:'pausa',    bg:'var(--surface2)',     color:'var(--text-muted)' },
  { id:'altro',    bg:'var(--accent-light)', color:'var(--accent)'     },
];
const defaultLabels = () => DEFAULT_LABEL_DEFS.map(l => ({ ...l, text: t('label.' + l.id) }));

const ST = { IDLE:'idle', RUNNING:'running', PAUSED:'paused' };
const LS = { dark:'darkMode', lastUser:'el_last_user' };
const LEGACY = { labels:'el_labels', timers:'el_timers', order:'el_timer_order', acts:'el_activities' };

let CSRF_TOKEN = null;
let appUser    = null;   // { user_id, username } — utente "attivo" su questo device (anche offline)
let sessionOk  = false;  // la sessione sul server è valida
let isOnline   = navigator.onLine;
let isDark     = false;
let authMode   = 'login';

/** Store locale. acts/timers sono mappe uid → record. */
let S = emptyStore();
const ticks = {};        // uid → setInterval dei timer in corso

function emptyStore() {
  return { v: STORE_VERSION, rev: 0, listClearedAt: null, acts: {}, timers: {}, labels: [], labelsDirty: false, labelsSeq: 0 };
}

// ═══════════════════════ STORE LOCALE ═══════════════════════
const storeKey = user => user ? `el_store_u${user.user_id}` : 'el_store_guest';

function readStore(user) {
  try {
    const s = JSON.parse(localStorage.getItem(storeKey(user)) || 'null');
    if (s && s.v === STORE_VERSION) return Object.assign(emptyStore(), s);
  } catch (e) {}
  return null;
}

function loadStore(user) {
  stopAllTicks();
  S = readStore(user) || emptyStore();
  if (!user) migrateLegacyGuestData();
  if (!Array.isArray(S.labels) || !S.labels.length) S.labels = defaultLabels();
}

let saveStoreT = null;
function saveStore(immediate = false) {
  clearTimeout(saveStoreT);
  // chiave e dati vengono fissati ora: un cambio utente nel frattempo non li mescola
  const key = storeKey(appUser), data = S;
  const write = () => {
    try { localStorage.setItem(key, JSON.stringify(data)); }
    catch (e) { console.error('[store] salvataggio non riuscito', e); }
  };
  if (immediate) write(); else saveStoreT = setTimeout(write, 150);
}
function dropLegacyKeys() { Object.values(LEGACY).forEach(k => { try { localStorage.removeItem(k); } catch (e) {} }); }

/** Converte i dati ospite salvati dalla 3.x (chiavi el_*) nello store 4.0. */
function migrateLegacyGuestData() {
  try {
    const acts = JSON.parse(localStorage.getItem(LEGACY.acts) || 'null');
    const tms  = JSON.parse(localStorage.getItem(LEGACY.timers) || 'null');
    const ord  = JSON.parse(localStorage.getItem(LEGACY.order) || '[]');
    const lbl  = JSON.parse(localStorage.getItem(LEGACY.labels) || 'null');
    if (Array.isArray(lbl) && lbl.length && !S.labels.length) S.labels = lbl.map(({ id, text, bg, color }) => ({ id, text, bg, color }));
    if (Array.isArray(acts)) for (const a of acts) {
      const act = newActRecord({
        description: a.description || '', category: a.category || 'altro', category_text: a.category_text || '',
        sessions: Array.isArray(a.sessions) ? a.sessions : [],
        created_at: parseSqlDate(a.created_at)?.toISOString() || new Date().toISOString(),
      });
      S.acts[act.uid] = act;
    }
    if (tms && typeof tms === 'object') {
      const ids = [...ord.filter(id => tms[id]), ...Object.keys(tms).filter(id => !ord.includes(id))];
      ids.forEach((id, i) => {
        const x = tms[id];
        const start = x.sessionStart ? Date.parse(x.sessionStart) : null;
        S.timers[id] = newTimerRecord({
          uid: id, position: i, state: x.state, sessionStart: start,
          accumulatedS: x.accumulatedS, liveSessions: x.liveSessions, description: x.description, category: x.category,
        });
      });
    }
  } catch (e) {}
  dropLegacyKeys();
}

// ── Record ──
function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function newActRecord(d) {
  const sessions = (d.sessions || []).map(s => ({ start: s.start || '', end: s.end || '', seconds: Math.max(0, parseInt(s.seconds, 10) || 0) }));
  return {
    uid: d.uid || uuid(), timer_id: d.timer_id || '',
    description: d.description || '', category: d.category || 'altro', category_text: d.category_text || '',
    sessions, total_seconds: sessions.reduce((s, x) => s + x.seconds, 0),
    created_at: d.created_at || new Date().toISOString(),
    version: d.version || 0, dirty: d.version ? false : true, seq: 1, deleted: false,
  };
}

function newTimerRecord(d) {
  const state = Object.values(ST).includes(d.state) ? d.state : ST.IDLE;
  const start = Number.isFinite(d.sessionStart) ? d.sessionStart : null;
  return {
    uid: d.uid || uuid(), position: d.position ?? nextTimerPosition(),
    state: (state === ST.RUNNING && !start) ? ST.PAUSED : state,
    sessionStart: state === ST.RUNNING ? start : null,
    accumulatedS: Math.max(0, parseInt(d.accumulatedS, 10) || 0),
    liveSessions: Array.isArray(d.liveSessions) ? d.liveSessions : [],
    description: typeof d.description === 'string' ? d.description : '',
    category: d.category || S.labels[0]?.id || 'altro',
    version: d.version || 0, dirty: d.version ? false : true, seq: 1, deleted: false,
  };
}

const actFromServer = r => ({
  uid: r.uid, timer_id: '', description: r.description, category: r.category, category_text: r.category_text,
  sessions: r.sessions || [], total_seconds: r.total_seconds || 0, created_at: r.created_at,
  version: r.version, dirty: false, seq: 0, deleted: false,
});
const timerFromServer = r => ({
  uid: r.uid, position: r.position, state: r.state, sessionStart: r.session_start ?? null,
  accumulatedS: r.accumulated_s || 0, liveSessions: r.live_sessions || [], description: r.description || '',
  category: r.category, version: r.version, dirty: false, seq: 0, deleted: false,
});
const actData = a => ({
  timer_id: a.timer_id || '', description: a.description, category: a.category, category_text: a.category_text,
  sessions: a.sessions, created_at: a.created_at,
});
const timerData = ts => ({
  position: ts.position, state: ts.state, session_start: ts.state === ST.RUNNING ? ts.sessionStart : null,
  accumulated_s: ts.accumulatedS, live_sessions: ts.liveSessions, description: ts.description, category: ts.category,
});
const sameAct   = (a, b) => JSON.stringify([a.description, a.category, a.category_text, a.sessions, a.created_at]) ===
                            JSON.stringify([b.description, b.category, b.category_text, b.sessions, b.created_at]);
const sameTimer = (a, b) => JSON.stringify(timerData(a)) === JSON.stringify(timerData(b));

// ── Viste derivate ──
function timerList() {
  return Object.values(S.timers).filter(ts => !ts.deleted).sort((a, b) => a.position - b.position || a.uid.localeCompare(b.uid));
}
function nextTimerPosition() {
  return Object.values(S.timers).reduce((m, ts) => Math.max(m, ts.position + 1), 0);
}
function visibleActs() {
  const cleared = S.listClearedAt ? Date.parse(S.listClearedAt) : 0;
  return Object.values(S.acts)
    .filter(a => !a.deleted && Date.parse(a.created_at) > cleared)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.uid.localeCompare(a.uid));
}
function pendingCount() {
  return Object.values(S.acts).filter(a => a.dirty).length
       + Object.values(S.timers).filter(ts => ts.dirty).length
       + (S.labelsDirty ? 1 : 0);
}
function storeHasPending(user) {
  const s = readStore(user);
  if (!s) return 0;
  return Object.values(s.acts).filter(a => a.dirty).length + Object.values(s.timers).filter(x => x.dirty).length + (s.labelsDirty ? 1 : 0);
}

// ── Modifiche locali ──
function touchAct(act)    { act.dirty = true; act.seq = (act.seq || 0) + 1; saveStore(); requestSync(); }
function touchTimer(ts)   { ts.dirty = true;  ts.seq  = (ts.seq  || 0) + 1; saveStore(); requestSync(); }
function touchLabels()    { S.labelsDirty = true; S.labelsSeq = (S.labelsSeq || 0) + 1; saveStore(); requestSync(); }

// ═══════════════════════ INIZIALIZZAZIONE ═══════════════════════
window.addEventListener('DOMContentLoaded', async () => {
  isDark = document.documentElement.classList.contains('dark');
  applyTheme();
  applyI18n();
  updateVersionTexts();
  bindStaticEvents();
  cleanSyncUrl();

  const lastUser = readLastUser();
  try {
    const res = await api('check');
    setOnline(true);
    CSRF_TOKEN = res.data?.csrf || null;
    if (res.data?.logged_in) {
      appUser = { user_id: res.data.user_id, username: res.data.username };
      sessionOk = true;
      writeLastUser(appUser);
      if (res.data.lang && res.data.lang !== currentLang) changeLanguage(res.data.lang, { persistServer:false });
    } else if (lastUser) {
      // Sessione scaduta: si riparte come ospite; le modifiche non inviate restano salvate
      // nello store di quell'utente e partiranno al prossimo login.
      const n = storeHasPending(lastUser);
      if (n) setTimeout(() => showToast(t('sync.pendingLogin', { n, name: lastUser.username })), 800);
    }
  } catch (e) {
    // Offline: si continua con l'ultimo utente che ha usato l'app su questo device
    setOnline(false);
    if (lastUser) { appUser = lastUser; sessionOk = true; }
  }

  // Le cache 3.x di un utente registrato non vanno importate come dati ospite
  if (appUser || lastUser) dropLegacyKeys();
  loadStore(appUser);
  // Su un device nuovo i timer arrivano dal server: niente timer vuoto "extra"
  if (timerList().length === 0 && !(appUser && isOnline && S.rev === 0)) addTimer({ render:false });
  updateAuthUI();
  renderAllTimers();
  renderActivities();
  updateSyncBadge();

  if (appUser && isOnline) await syncNow({ full: S.rev === 0 });
  if (timerList().length === 0) { addTimer({ render:false }); renderAllTimers(); }

  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, SYNC_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { saveStore(true); syncNow({ keepalive:true }); }
    else syncNow();
  });
  window.addEventListener('focus', () => syncNow());
  window.addEventListener('online',  () => { setOnline(true); syncNow(); });
  window.addEventListener('offline', () => setOnline(false));
  window.addEventListener('pagehide', () => saveStore(true));
  document.addEventListener('focusout', () => { if (pendingRender) setTimeout(flushPendingRender, 0); });

  if (sessionStorage.getItem('el_synced')) {
    sessionStorage.removeItem('el_synced');
    showToast(pendingCount() ? t('sync.stillPending', { n: pendingCount() }) : t('sync.done'));
  }
  registerServiceWorker();
});

function bindStaticEvents() {
  const onEnter = (id, fn) => document.getElementById(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') fn(); });
  onEnter('authUser', submitAuth);
  onEnter('authPass', submitAuth);
  onEnter('resetUser', requestReset);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
}

function updateVersionTexts() {
  const v = window.APP_VERSION || '';
  document.querySelectorAll('[data-version]').forEach(el => {
    el.textContent = el.dataset.version === 'about' ? t('about.version', { v }) : `EasyLogger v${v} by sputlab.com`;
  });
}

function readLastUser() {
  try { const u = JSON.parse(localStorage.getItem(LS.lastUser) || 'null'); return u?.user_id ? u : null; }
  catch (e) { return null; }
}
function writeLastUser(u) {
  try { u ? localStorage.setItem(LS.lastUser, JSON.stringify({ user_id: u.user_id, username: u.username })) : localStorage.removeItem(LS.lastUser); }
  catch (e) {}
}

function cleanSyncUrl() {
  if (new URLSearchParams(location.search).has('_')) {
    const u = new URL(location.href); u.searchParams.delete('_');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
}

// ═══════════════════════ SERVICE WORKER (PWA offline) ═══════════════════════
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.php').catch(e => console.warn('[sw]', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) showToast(t('sw.updated'), 6000);
  });
}

// ═══════════════════════ MOTORE DI SINCRONIZZAZIONE ═══════════════════════
let syncing = false;
let syncAgain = false;
let syncT = null;

/** Richiede una sincronizzazione a breve (le modifiche ravvicinate vengono accorpate). */
function requestSync(delay = 1200) {
  updateSyncBadge();
  if (!appUser) return;
  clearTimeout(syncT);
  syncT = setTimeout(() => syncNow(), delay);
}

/** Push delle modifiche in coda + pull dei cambiamenti dal server. */
async function syncNow({ full = false, keepalive = false } = {}) {
  if (!appUser || !sessionOk) { updateSyncBadge(); return false; }
  if (syncing) { syncAgain = true; return false; }
  clearTimeout(syncT);
  syncing = true;
  updateSyncBadge();
  let ok = false;
  try {
    await pushPending(keepalive);
    if (!keepalive) await pullChanges(full);
    setOnline(true);
    ok = true;
  } catch (e) {
    if (e.code === 'network') setOnline(false);
  } finally {
    syncing = false;
    saveStore();
    updateSyncBadge();
    if (syncAgain) { syncAgain = false; requestSync(300); }
  }
  return ok;
}

async function pushPending(keepalive) {
  const ops = [];
  const sent = [];
  for (const a of Object.values(S.acts)) if (a.dirty) {
    ops.push(a.deleted
      ? { type:'activity', uid:a.uid, deleted:true }
      : { type:'activity', uid:a.uid, base_version:a.version, data: actData(a) });
    sent.push({ kind:'act', rec:a, seq:a.seq });
  }
  for (const ts of Object.values(S.timers)) if (ts.dirty) {
    ops.push(ts.deleted
      ? { type:'timer', uid:ts.uid, deleted:true }
      : { type:'timer', uid:ts.uid, base_version:ts.version, data: timerData(ts) });
    sent.push({ kind:'timer', rec:ts, seq:ts.seq });
  }
  if (S.labelsDirty) {
    ops.push({ type:'labels', labels: S.labels.map(({ id, text, bg, color }) => ({ id, text, bg, color })) });
    sent.push({ kind:'labels', seq:S.labelsSeq });
  }
  if (!ops.length) return;

  let conflicts = 0, changed = false;
  for (let i = 0; i < ops.length; i += 100) {
    const res = await api('push', { ops: ops.slice(i, i + 100) }, { keepalive });
    (res.data?.results || []).forEach((r, j) => {
      const s = sent[i + j];
      if (!s) return;
      if (s.kind === 'labels') {
        if (r.status === 'ok' && S.labelsSeq === s.seq) S.labelsDirty = false;
        if (r.status === 'invalid') S.labelsDirty = false;
        return;
      }
      const map = s.kind === 'act' ? S.acts : S.timers;
      const rec = s.rec;
      if (map[rec.uid] !== rec) return; // sostituito nel frattempo
      if (r.status === 'ok') {
        rec.version = r.version;
        if (rec.seq === s.seq) {
          rec.dirty = false;
          if (rec.deleted) { delete map[rec.uid]; changed = true; }
        }
      } else if (r.status === 'conflict' && r.record) {
        map[rec.uid] = r.record.deleted ? undefined : (s.kind === 'act' ? actFromServer(r.record) : timerFromServer(r.record));
        if (r.record.deleted) delete map[rec.uid];
        conflicts++; changed = true;
      } else if (r.status === 'gone') {
        delete map[rec.uid]; changed = true;          // eliminato su un altro device: l'eliminazione vince
      } else if (r.status === 'invalid') {
        console.warn('[sync] operazione rifiutata', r); // non ritentare all'infinito
        rec.dirty = false;
      }
    });
  }
  if (conflicts) showToast(t('sync.conflict', { n: conflicts }), 5000);
  if (changed) scheduleRender();
}

async function pullChanges(full) {
  const since = full ? 0 : (S.rev || 0);
  const d = (await api('sync', null, { query: `since=${since}` })).data || {};
  let changedActs = false, changedTimers = false, changedLabels = false;

  if (d.full) {
    // Sync completa: rimuove ciò che non esiste più sul server (salvo modifiche locali non inviate)
    const actIds = new Set((d.activities || []).map(r => r.uid));
    const tmIds  = new Set((d.timers || []).map(r => r.uid));
    for (const [id, a] of Object.entries(S.acts))   if (!a.dirty && !actIds.has(id)) { delete S.acts[id];   changedActs = true; }
    for (const [id, x] of Object.entries(S.timers)) if (!x.dirty && !tmIds.has(id))  { delete S.timers[id]; changedTimers = true; }
  }

  for (const r of d.activities || []) {
    const local = S.acts[r.uid];
    if (local?.dirty) continue;                 // la modifica locale in coda ha la precedenza
    if (r.deleted) { if (local) { delete S.acts[r.uid]; changedActs = true; } continue; }
    const rec = actFromServer(r);
    if (!local || local.version !== rec.version || !sameAct(local, rec)) { S.acts[r.uid] = rec; changedActs = true; }
  }
  for (const r of d.timers || []) {
    const local = S.timers[r.uid];
    if (local?.dirty) continue;
    if (r.deleted) { if (local) { delete S.timers[r.uid]; changedTimers = true; } continue; }
    const rec = timerFromServer(r);
    if (!local || local.version !== rec.version || !sameTimer(local, rec)) { S.timers[r.uid] = rec; changedTimers = true; }
  }
  if (Array.isArray(d.labels) && !S.labelsDirty) {
    const next = d.labels.length ? d.labels : S.labels;
    if (JSON.stringify(next) !== JSON.stringify(S.labels.map(({ id, text, bg, color }) => ({ id, text, bg, color })))) {
      S.labels = next; changedLabels = true;
    }
    if (!d.labels.length && d.full) touchLabels();  // account nuovo: carica le etichette predefinite
  }
  if ((d.list_cleared_at || null) !== (S.listClearedAt || null)) { S.listClearedAt = d.list_cleared_at || null; changedActs = true; }
  S.rev = d.rev || 0;

  // Almeno un timer sempre presente
  if (timerList().length === 0) { addTimer({ render:false }); changedTimers = true; }

  if (changedActs || changedTimers || changedLabels) scheduleRender({ timers: changedTimers || changedLabels, acts: changedActs || changedLabels, labels: changedLabels });
}

/* Il rendering viene rimandato se l'utente sta scrivendo in un campo che verrebbe ricreato */
let pendingRender = null;
function scheduleRender(what = { timers:true, acts:true, labels:true }) {
  pendingRender = {
    timers: (pendingRender?.timers || what.timers),
    acts:   (pendingRender?.acts   || what.acts),
    labels: (pendingRender?.labels || what.labels),
  };
  flushPendingRender();
}
function flushPendingRender() {
  if (!pendingRender) return;
  const ae = document.activeElement;
  const editing = ae && ae.matches && ae.matches('input, textarea, select') && ae.closest('#timerStack, #actList, #labelList');
  if (editing) return; // riproverà al focusout
  const r = pendingRender; pendingRender = null;
  if (r.timers) renderAllTimers();
  if (r.acts) renderActivities();
  if (r.labels && currentPage() === 'account') renderLabelList();
}

function setOnline(v) {
  isOnline = v;
  updateSyncBadge();
}

function updateSyncBadge() {
  const el = document.getElementById('syncBadge');
  if (!el) return;
  const n = appUser ? pendingCount() : 0;
  let text = '', cls = '';
  if (appUser && !isOnline)        { text = n ? t('sync.badgeOfflineN', { n }) : t('sync.badgeOffline'); cls = 'off'; }
  else if (appUser && !sessionOk)  { text = t('sync.badgeLogin'); cls = 'warn'; }
  else if (appUser && (n || syncing)) { text = syncing ? t('sync.badgeSyncing') : t('sync.badgePending', { n }); cls = 'pending'; }
  el.textContent = text;
  el.className = 'sync-badge ' + cls;
  el.style.display = text ? '' : 'none';
  el.title = text;
}

/** Voce di menu: invia la coda, forza una sync completa, aggiorna l'app e ricarica. */
async function forceSync() {
  showToast(t('sync.running'));
  if (appUser && sessionOk) {
    await syncNow();
    S.rev = 0;        // al ricaricamento: sync completa dal database
    saveStore(true);
  }
  try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch (e) {}
  sessionStorage.setItem('el_synced', '1');
  const url = new URL(location.href);
  url.searchParams.set('_', Date.now().toString(36));
  location.replace(url.toString());
}

// ═══════════════════════ NAVIGAZIONE E DRAWER ═══════════════════════
function nav(page) {
  const el = document.getElementById('page-' + page);
  if (!el) return;
  if (page === 'account' && (!appUser || !sessionOk)) { nav('auth'); return; }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  if (page === 'account') { loadStats(); renderLabelList(); }
  if (page === 'auth' && appUser && !sessionOk) document.getElementById('authUser').value = appUser.username;
  window.scrollTo(0, 0);
}
function currentPage() { return document.querySelector('.page.active')?.id?.replace('page-', '') || 'home'; }

function toggleDrawer() {
  const open = !document.getElementById('drawer').classList.contains('open');
  document.getElementById('drawer').classList.toggle('open', open);
  document.getElementById('drawerOverlay').classList.toggle('open', open);
  document.getElementById('burgerBtn').setAttribute('aria-expanded', String(open));
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerOverlay').classList.remove('open');
  document.getElementById('burgerBtn')?.setAttribute('aria-expanded', 'false');
}

// ═══════════════════════ TEMA ═══════════════════════
function applyTheme() {
  document.documentElement.classList.toggle('dark', isDark);
  document.getElementById('themeIcon').textContent = isDark ? '☀️' : '🌙';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isDark ? '#1e1c19' : '#d4500a';
}
function toggleTheme() {
  isDark = !isDark;
  try { localStorage.setItem(LS.dark, String(isDark)); } catch (e) {}
  applyTheme();
}

// ═══════════════════════ LINGUA ═══════════════════════
function toggleLanguage() { changeLanguage(currentLang === 'it' ? 'en' : 'it'); }

function changeLanguage(lang, { persistServer = true } = {}) {
  if (!I18N[lang] || lang === currentLang) return;
  const oldLang = currentLang;
  setLang(lang);

  // Le etichette predefinite non rinominate dall'utente vengono tradotte
  let labelsChanged = false;
  for (const l of S.labels) {
    const oldText = I18N[oldLang]?.['label.' + l.id];
    if (oldText && l.text === oldText) { l.text = t('label.' + l.id); labelsChanged = true; }
  }
  if (labelsChanged) touchLabels();

  updateVersionTexts();
  updateAuthModeTexts();
  updateAuthUI();
  updateSyncBadge();
  renderAllTimers();
  renderActivities();
  if (currentPage() === 'account' && appUser) { renderLabelList(); loadStats(); }
  if (appUser && sessionOk && persistServer) api('update_profile', { type:'lang', lang }).catch(() => {});
}

// ═══════════════════════ AUTENTICAZIONE ═══════════════════════
function updateAuthUI() {
  const pill = document.getElementById('userPill');
  const logged = !!appUser;
  pill.textContent = logged ? '👤 ' + appUser.username : '';
  pill.style.display = logged ? '' : 'none';
  document.getElementById('drawerLoginBtn').style.display   = logged && sessionOk ? 'none' : '';
  document.getElementById('drawerAccountBtn').style.display = logged && sessionOk ? '' : 'none';
  document.getElementById('drawerLogoutBtn').style.display  = logged ? '' : 'none';
  const hint = document.getElementById('guestHint');
  if (hint) hint.style.display = logged ? 'none' : '';
}

function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  updateAuthModeTexts();
  hideErr('authErr');
}
function updateAuthModeTexts() {
  const m = authMode === 'register' ? 'register' : 'login';
  document.getElementById('authTitle').textContent      = t(`auth.${m}.title`);
  document.getElementById('authSub').textContent        = t(`auth.${m}.sub`);
  document.getElementById('authSubmit').textContent     = t(`auth.${m}.submit`);
  document.getElementById('authSwitchText').textContent = t(`auth.${m}.switchText`);
  document.getElementById('authSwitchBtn').textContent  = t(`auth.${m}.switchBtn`);
  document.getElementById('authPass').autocomplete = m === 'register' ? 'new-password' : 'current-password';
}

async function submitAuth() {
  const btn = document.getElementById('authSubmit');
  const un = document.getElementById('authUser').value.trim();
  const pw = document.getElementById('authPass').value;
  hideErr('authErr');
  if (!un || !pw) { showErr('authErr', t('common.fillAll')); return; }
  if (authMode === 'register' && pw.length < PASSWORD_MIN) { showErr('authErr', t('common.passwordMin', { n: PASSWORD_MIN })); return; }
  if (btn.disabled) return;
  btn.disabled = true;

  try {
    const payload = { username: un, password: pw };
    if (authMode === 'register') payload.lang = currentLang;
    const res = await api(authMode, payload);
    setOnline(true);
    CSRF_TOKEN = res.data.csrf || CSRF_TOKEN;
    const user = { user_id: res.data.user_id, username: res.data.username };

    let imported = 0;
    if (appUser && appUser.user_id === user.user_id) {
      // Nuovo login dopo sessione scaduta: stesso store, la coda riparte
      appUser.username = user.username;
    } else {
      const guest = appUser ? null : S;   // dati ospite da portare nell'account
      saveStore(true);
      appUser = user;
      loadStore(appUser);
      if (guest) imported = mergeGuestStore(guest);
    }
    sessionOk = true;
    writeLastUser(appUser);
    if (res.data.lang && res.data.lang !== currentLang) changeLanguage(res.data.lang, { persistServer:false });

    await syncNow({ full: true });
    if (timerList().length === 0) addTimer({ render:false });

    document.getElementById('authPass').value = '';
    updateAuthUI();
    renderAllTimers();
    renderActivities();
    nav('home');
    showToast(t('auth.hello', { name: appUser.username }) + (imported ? ' · ' + t('auth.localImported', { n: imported }) : ''));
  } catch (e) {
    showErr('authErr', e.message);
  } finally {
    btn.disabled = false;
  }
}

/** Sposta attività e timer creati da ospite nello store dell'utente (verranno inviati al server). */
function mergeGuestStore(guest) {
  let n = 0;
  for (const a of Object.values(guest.acts)) {
    if (a.deleted || S.acts[a.uid]) continue;
    S.acts[a.uid] = { ...a, version: 0, dirty: true, seq: 1 };
    n++;
  }
  let pos = nextTimerPosition();
  for (const ts of Object.values(guest.timers)) {
    if (ts.deleted || S.timers[ts.uid]) continue;
    if (ts.state === ST.IDLE && !ts.description.trim()) continue;
    S.timers[ts.uid] = { ...ts, position: pos++, version: 0, dirty: true, seq: 1 };
  }
  try { localStorage.removeItem(storeKey(null)); } catch (e) {}
  saveStore(true);
  return n;
}

async function doLogout() {
  if (appUser && sessionOk) await syncNow();
  const pending = appUser ? pendingCount() : 0;
  if (pending && !confirm(t('sync.logoutPending', { n: pending }))) return;
  if (sessionOk) { try { await api('logout', {}); } catch (e) {} }
  // Senza modifiche in sospeso i dati dell'account non restano sul device
  const keep = pending > 0;
  if (!keep && appUser) { clearTimeout(saveStoreT); try { localStorage.removeItem(storeKey(appUser)); } catch (e) {} }
  writeLastUser(null);
  await switchToGuest({ persist: keep });
  showToast(t('auth.bye'));
  nav('home');
}

async function switchToGuest({ persist = true } = {}) {
  if (appUser && persist) saveStore(true); else clearTimeout(saveStoreT);
  appUser = null;
  sessionOk = false;
  loadStore(null);
  if (timerList().length === 0) addTimer({ render:false });
  CSRF_TOKEN = null;
  try { const r = await api('check'); CSRF_TOKEN = r.data?.csrf || null; setOnline(true); } catch (e) {}
  updateAuthUI();
  updateSyncBadge();
  renderAllTimers();
  renderActivities();
}

let sessionExpiredShown = false;
function handleSessionExpired() {
  if (!appUser || !sessionOk) return;
  sessionOk = false;          // i dati restano sul device e continuano a funzionare offline
  updateAuthUI();
  updateSyncBadge();
  if (sessionExpiredShown) return;
  sessionExpiredShown = true;
  showToast(t('common.sessionExpired'), 5000);
  nav('auth');
  setTimeout(() => { sessionExpiredShown = false; }, 5000);
}

// ═══════════════════════ TIMER ═══════════════════════
function addTimer({ render = true } = {}) {
  const ts = newTimerRecord({});
  S.timers[ts.uid] = ts;
  touchTimer(ts);
  if (render) renderAllTimers();
  return ts.uid;
}

function renderAllTimers() {
  const stack = document.getElementById('timerStack');
  stack.innerHTML = '';
  const list = timerList();
  list.forEach((ts, idx) => stack.appendChild(buildTimerCard(ts, idx + 1)));
  stopAllTicks();
  for (const ts of list) { if (ts.state === ST.RUNNING) startTick(ts.uid); else tickTimer(ts.uid); }
}

function buildTimerCard(ts, seq) {
  const id = ts.uid;
  const card = document.createElement('div');
  card.className = 'timer-card';
  card.id = 'tc-' + id;

  card.innerHTML = `
    <div class="tc-head">
      <div class="tc-head-top">
        <div class="tc-num">T${seq}</div>
        <textarea class="tc-desc" rows="1"></textarea>
        <button class="tc-remove" type="button">✕</button>
      </div>
      <div class="tc-head-bottom">
        <div class="tc-cat"><select></select></div>
      </div>
    </div>
    <div class="tc-digits">00:00:00</div>
    <div class="tc-status"></div>
    <div class="tc-chips"></div>
    <div class="tc-btns">
      <button class="tc-btn start" type="button" data-act="sp"></button>
      <button class="tc-btn save-btn" type="button" data-act="save" disabled></button>
      <button class="tc-btn discard" type="button" data-act="disc" disabled></button>
    </div>
  `;

  const ta = card.querySelector('.tc-desc');
  ta.placeholder = t('timer.descPh');
  ta.setAttribute('aria-label', t('timer.descPh'));
  ta.value = ts.description;
  requestAnimationFrame(() => autoResize(ta));
  ta.addEventListener('input', () => {
    autoResize(ta);
    const cur = S.timers[id]; if (!cur) return;
    cur.description = ta.value;
    touchTimer(cur);
  });

  const rem = card.querySelector('.tc-remove');
  rem.title = t('timer.remove');
  rem.setAttribute('aria-label', t('timer.remove'));
  rem.addEventListener('click', () => removeTimer(id));

  const sel = card.querySelector('select');
  sel.setAttribute('aria-label', t('timer.label'));
  populateLabelSelect(sel, ts.category);
  if (sel.value && sel.value !== ts.category) { ts.category = sel.value; touchTimer(ts); } // etichetta non più esistente
  sel.addEventListener('change', () => {
    const cur = S.timers[id]; if (!cur) return;
    cur.category = sel.value;
    applyLabelStyle(card.querySelector('.tc-cat'), cur.category);
    touchTimer(cur);
  });
  applyLabelStyle(card.querySelector('.tc-cat'), sel.value);

  card.querySelector('[data-act="sp"]').addEventListener('click', () => timerStartPause(id));
  card.querySelector('[data-act="save"]').addEventListener('click', () => timerSave(id));
  card.querySelector('[data-act="disc"]').addEventListener('click', () => timerDiscard(id));

  updateTimerCardUI(ts, card);
  return card;
}

function updateTimerCardUI(ts, card) {
  if (!card) card = document.getElementById('tc-' + ts.uid);
  if (!card) return;
  const cls = ts.state === ST.RUNNING ? 'running' : ts.state === ST.PAUSED ? 'paused' : '';
  card.className = 'timer-card ' + cls;
  card.querySelector('.tc-digits').className = 'tc-digits ' + cls;

  const idle = ts.state === ST.IDLE;
  const sp = card.querySelector('[data-act="sp"]');
  sp.textContent = t(ts.state === ST.RUNNING ? 'timer.pause' : ts.state === ST.PAUSED ? 'timer.resume' : 'timer.start');
  sp.className = 'tc-btn ' + (ts.state === ST.RUNNING ? 'pause-btn' : ts.state === ST.PAUSED ? 'resume' : 'start');
  const save = card.querySelector('[data-act="save"]'); save.textContent = t('timer.save');    save.disabled = idle;
  const disc = card.querySelector('[data-act="disc"]'); disc.textContent = t('timer.discard'); disc.disabled = idle;
}

function startTick(id) {
  stopTick(id);
  ticks[id] = setInterval(() => tickTimer(id), 1000);
  tickTimer(id);
}
function stopTick(id) { if (ticks[id]) { clearInterval(ticks[id]); delete ticks[id]; } }
function stopAllTicks() { Object.keys(ticks).forEach(stopTick); }

function runningSeconds(ts) {
  return (ts.state === ST.RUNNING && ts.sessionStart) ? Math.max(0, Math.floor((Date.now() - ts.sessionStart) / 1000)) : 0;
}

function tickTimer(id) {
  const ts = S.timers[id];
  const card = document.getElementById('tc-' + id);
  if (!ts || !card) { stopTick(id); return; }
  const runSecs = runningSeconds(ts);
  card.querySelector('.tc-digits').textContent = fmt(ts.accumulatedS + runSecs);

  const statusEl = card.querySelector('.tc-status');
  const chipsEl  = card.querySelector('.tc-chips');
  statusEl.textContent = '';
  chipsEl.textContent = '';
  if (ts.state === ST.IDLE) return;

  const completed = ts.liveSessions.length;
  const dot = document.createElement('span');
  dot.className = ts.state === ST.RUNNING ? 'sdot' : 'sdot p';
  statusEl.append(dot, document.createTextNode(ts.state === ST.RUNNING
    ? t('timer.running', { n: completed + 1, time: fmt(runSecs) })
    : t('timer.paused',  { n: completed })));

  ts.liveSessions.forEach((s, i) => {
    const chip = document.createElement('span');
    chip.className = 'chip done';
    chip.textContent = `S${i + 1} ${s.start}→${s.end} (${fmt(s.seconds)})`;
    chipsEl.appendChild(chip);
  });
  if (ts.state === ST.RUNNING) {
    const chip = document.createElement('span');
    chip.className = 'chip live';
    chip.textContent = t('timer.live', { n: completed + 1 });
    chipsEl.appendChild(chip);
  }
}

/** Segmento della sessione in corso (senza modificare il timer). */
function runningSegment(ts) {
  if (ts.state !== ST.RUNNING || !ts.sessionStart) return null;
  const end = Date.now();
  return { start: toHHMM(new Date(ts.sessionStart)), end: toHHMM(new Date(end)), seconds: Math.max(0, Math.floor((end - ts.sessionStart) / 1000)) };
}

function timerStartPause(id) {
  const ts = S.timers[id];
  if (!ts) return;
  if (ts.state === ST.IDLE) {
    Object.assign(ts, { sessionStart: Date.now(), accumulatedS: 0, liveSessions: [], state: ST.RUNNING });
    startTick(id);
  } else if (ts.state === ST.RUNNING) {
    const seg = runningSegment(ts);
    if (seg) { ts.liveSessions.push(seg); ts.accumulatedS += seg.seconds; }
    Object.assign(ts, { sessionStart: null, state: ST.PAUSED });
    stopTick(id);
    tickTimer(id);
  } else {
    Object.assign(ts, { sessionStart: Date.now(), state: ST.RUNNING });
    startTick(id);
  }
  updateTimerCardUI(ts);
  touchTimer(ts);
}

/* Salvataggio "local-first": l'attività viene creata subito in locale con un uid
   univoco e messa in coda; non può fallire e non crea duplicati se reinviata. */
function timerSave(id) {
  const ts = S.timers[id];
  if (!ts || ts.state === ST.IDLE) return;

  const sessions = ts.liveSessions.slice();
  let total = ts.accumulatedS;
  const seg = runningSegment(ts);
  if (seg) { sessions.push(seg); total += seg.seconds; }
  if (total <= 0) { showToast(t('timer.noTime')); return; }

  const label = S.labels.find(l => l.id === ts.category);
  const act = newActRecord({
    timer_id: id,
    description: ts.description.trim() || t('timer.untitled'),
    category: ts.category,
    category_text: label ? label.text : ts.category,
    sessions,
  });
  S.acts[act.uid] = act;
  touchAct(act);

  stopTick(id);
  if (timerList().length > 1) {
    ts.deleted = true;
    if (!ts.version) delete S.timers[id]; else touchTimer(ts);
  } else {
    Object.assign(ts, { state: ST.IDLE, sessionStart: null, accumulatedS: 0, liveSessions: [], description: '', category: S.labels[0]?.id || 'altro' });
    touchTimer(ts);
  }
  saveStore(true);
  renderAllTimers();
  renderActivities();
  requestSync(200);
  showToast(t('timer.saved'));
}

function timerDiscard(id) {
  const ts = S.timers[id];
  if (!ts || !confirm(t('timer.confirmDiscard'))) return;
  stopTick(id);
  Object.assign(ts, { state: ST.IDLE, sessionStart: null, accumulatedS: 0, liveSessions: [] });
  updateTimerCardUI(ts);
  tickTimer(id);
  touchTimer(ts);
  showToast(t('timer.discarded'));
}

function removeTimer(id) {
  const ts = S.timers[id];
  if (!ts) return;
  if (ts.state !== ST.IDLE && !confirm(t('timer.confirmRemove'))) return;
  stopTick(id);
  ts.deleted = true;
  if (!ts.version) { delete S.timers[id]; saveStore(); requestSync(); } else touchTimer(ts);
  if (timerList().length === 0) addTimer({ render:false });
  renderAllTimers();
  showToast(t('timer.removed'));
}

// ═══════════════════════ ATTIVITÀ ═══════════════════════
function renderActivities() {
  const list = document.getElementById('actList');
  const acts = visibleActs();
  updateGrandTotal(acts);
  list.innerHTML = '';

  if (!acts.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = '<div class="ico">⏱</div>' + t('home.empty');
    list.appendChild(empty);
    return;
  }
  acts.forEach((act, idx) => list.appendChild(buildActCard(act, acts.length - idx)));
}

function buildActCard(act, displayNum) {
  const uid = act.uid;
  const cur = () => S.acts[uid];
  const card = document.createElement('div');
  card.className = 'act-card';

  const label = S.labels.find(l => l.id === act.category);
  const labelText = act.category_text || label?.text || act.category || '';

  const head = document.createElement('div'); head.className = 'ac-head';
  const num = document.createElement('div'); num.className = 'ac-num';
  num.textContent = `#${String(displayNum).padStart(2, '0')}`;

  const tw = document.createElement('div'); tw.className = 'ac-title-wrap';
  const ta = document.createElement('textarea'); ta.className = 'ac-title'; ta.rows = 1;
  ta.placeholder = t('act.descPh');
  ta.setAttribute('aria-label', t('act.descPh'));
  ta.value = act.description;
  ta.addEventListener('input', () => autoResize(ta));
  ta.addEventListener('blur', () => {
    const a = cur(); if (!a) return;
    const v = ta.value.trim();
    if (!v) { ta.value = a.description; autoResize(ta); return; }
    if (v === a.description) return;
    a.description = v;
    touchAct(a);
  });
  requestAnimationFrame(() => autoResize(ta));
  tw.appendChild(ta);

  const meta = document.createElement('div'); meta.className = 'ac-date';
  meta.textContent = formatActDate(act.created_at);
  if (act.dirty && appUser) {
    const p = document.createElement('span'); p.className = 'ac-pending'; p.textContent = ' · ' + t('sync.notSynced');
    p.title = t('sync.notSyncedTitle');
    meta.appendChild(p);
  }
  tw.appendChild(meta);

  const tagEl = document.createElement('span');
  tagEl.className = 'ac-tag';
  tagEl.style.background = label?.bg || 'var(--surface2)';
  tagEl.style.color = label?.color || 'var(--text-muted)';
  tagEl.textContent = labelText;
  head.append(num, tw, tagEl);

  const sw = document.createElement('div'); sw.className = 'sess-wrap';
  const sl = document.createElement('div'); sl.className = 'sess-lbl'; sl.textContent = t('act.sessions');
  sw.appendChild(sl);

  const foot = document.createElement('div'); foot.className = 'ac-foot';
  const totEl = document.createElement('div'); totEl.className = 'ac-total';

  const refresh = () => {
    const a = cur(); if (!a) return;
    recalcActTotal(a);
    sw.querySelectorAll('.sess-row').forEach(r => r.remove());
    a.sessions.forEach((sess, si) => sw.appendChild(buildSessRow(a, sess, si, refresh)));
    totEl.textContent = '';
    const lbl = document.createElement('span'); lbl.textContent = t('act.total');
    totEl.append(lbl, document.createTextNode(fmt(a.total_seconds)));
    updateGrandTotal();
  };
  refresh();

  const actions = document.createElement('div'); actions.className = 'ac-actions';
  const addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'sm-btn add';
  addBtn.textContent = t('act.addSession');
  addBtn.addEventListener('click', () => {
    const a = cur(); if (!a) return;
    a.sessions.push({ start: '', end: '', seconds: 0 });
    refresh();
    touchAct(a);
    showToast(t('act.sessionAdded'));
  });

  const delBtn = document.createElement('button'); delBtn.type = 'button'; delBtn.className = 'sm-btn del';
  delBtn.textContent = t('act.delete');
  delBtn.addEventListener('click', () => {
    if (!confirm(t('act.confirmDelete'))) return;
    deleteActivity(uid);
  });

  actions.append(addBtn, delBtn);
  foot.append(totEl, actions);
  card.append(head, sw, foot);
  return card;
}

function buildSessRow(act, sess, si, refresh) {
  const row = document.createElement('div'); row.className = 'sess-row';
  const idxEl = document.createElement('div'); idxEl.className = 'si'; idxEl.textContent = `S${si + 1}`;

  const onTime = key => v => { sess[key] = v; recalcSess(sess); refresh(); touchAct(act); };
  const startF = makeTF(t('act.start'), sess.start || '', onTime('start'));
  const endF   = makeTF(t('act.end'),   sess.end   || '', onTime('end'));

  const durEl = document.createElement('div');
  durEl.className = `sd${!sess.seconds ? ' z' : ''}`;
  durEl.textContent = fmt(sess.seconds || 0);

  const del = document.createElement('button'); del.type = 'button'; del.className = 'ds-btn'; del.textContent = '×';
  del.title = t('act.deleteSession');
  del.setAttribute('aria-label', t('act.deleteSession'));
  del.addEventListener('click', () => {
    act.sessions.splice(si, 1);
    refresh();
    touchAct(act);
    showToast(t('act.sessionDeleted'));
  });

  row.append(idxEl, startF, endF, durEl, del);
  return row;
}

function makeTF(label, value, onChange) {
  const w = document.createElement('label'); w.className = 'tf';
  const l = document.createElement('span'); l.className = 'tf-lbl'; l.textContent = label;
  const i = document.createElement('input'); i.type = 'time'; i.value = value;
  i.addEventListener('change', () => onChange(i.value));
  w.append(l, i);
  return w;
}

function deleteActivity(uid) {
  const a = S.acts[uid];
  if (!a) return;
  if (!a.version) delete S.acts[uid];   // mai arrivata al server: basta toglierla
  else { a.deleted = true; touchAct(a); }
  saveStore();
  requestSync();
  renderActivities();
  showToast(t('act.deleted'));
}

function recalcSess(sess) {
  if (sess.start && sess.end) {
    const [sh, sm] = sess.start.split(':').map(Number);
    const [eh, em] = sess.end.split(':').map(Number);
    let s = ((eh * 60 + em) - (sh * 60 + sm)) * 60;
    if (s < 0) s += 86400; // attraversa la mezzanotte
    sess.seconds = s;
  } else {
    sess.seconds = 0;
  }
}
function recalcActTotal(act) {
  act.total_seconds = (act.sessions || []).reduce((s, x) => s + (x.seconds || 0), 0);
}
function updateGrandTotal(acts = visibleActs()) {
  document.getElementById('grandTotal').textContent = fmt(acts.reduce((s, a) => s + (a.total_seconds || 0), 0));
  document.getElementById('actCount').textContent = acts.length;
}

async function confirmResetAll() {
  const acts = visibleActs();
  if (!acts.length) return;
  if (!confirm(t(appUser ? 'act.confirmResetList' : 'act.confirmResetListGuest'))) return;
  if (appUser) {
    // È un'impostazione dell'account (vale per tutti i device): richiede la connessione
    if (!sessionOk) { showToast(t('sync.needLogin')); return; }
    try {
      await syncNow();
      const r = await api('clear_list', {});
      S.listClearedAt = r.data?.list_cleared_at || new Date().toISOString();
    } catch (e) {
      showToast(e.code === 'network' ? t('sync.needOnline') : t('act.error', { msg: e.message }));
      return;
    }
  } else {
    for (const a of acts) delete S.acts[a.uid];
  }
  saveStore(true);
  renderActivities();
  showToast(t('act.listCleared'));
}

// ═══════════════════════ EXPORT PDF ═══════════════════════
function exportPDF() {
  const acts = visibleActs();
  if (!acts.length) { showToast(t('pdf.noActivities')); return; }
  if (!window.jspdf?.jsPDF) { showToast(t('pdf.libMissing')); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ml = 15, mr = 15; let y = 0;
  const need = n => { if (y + n > H - 12) { doc.addPage(); y = 15; } };
  const now = new Date();

  doc.setFillColor(212, 80, 10); doc.rect(0, 0, W, 22, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 255, 255);
  doc.text(t('pdf.title'), ml, 14);
  if (appUser) doc.text(appUser.username, W - ml, 14, { align:'right' });
  y = 30;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(140, 133, 125);
  doc.text(`${now.toLocaleDateString(locale())} ${now.toLocaleTimeString(locale())}`, ml, y);
  y += 10;

  [...acts].reverse().forEach((act, i) => {
    need(48);
    doc.setFillColor(245, 240, 235); doc.roundedRect(ml, y, W - ml - mr, 8, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(140, 133, 125);
    const categoryLabel = act.category_text || S.labels.find(l => l.id === act.category)?.text || act.category || '';
    const dateStr = formatActDate(act.created_at);
    doc.text(`#${String(i + 1).padStart(2, '0')}  ${categoryLabel.toUpperCase()}${dateStr ? '  ·  ' + dateStr : ''}`, ml + 3, y + 5.5);
    doc.setTextColor(212, 80, 10);
    doc.text(`${t('pdf.total')}: ${fmt(act.total_seconds || 0)}`, W - mr - 3, y + 5.5, { align:'right' });
    y += 11;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 23, 20);
    doc.splitTextToSize(act.description || '', W - ml - mr - 4).forEach(l => { need(7); doc.text(l, ml + 2, y); y += 6; });
    y += 3;
    if (act.sessions?.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(140, 133, 125);
      doc.text(t('pdf.sess'), ml + 2, y); doc.text(t('pdf.start'), ml + 28, y);
      doc.text(t('pdf.end'), ml + 60, y); doc.text(t('pdf.duration'), ml + 92, y);
      y += 4; doc.setDrawColor(220, 215, 210); doc.line(ml, y, W - mr, y); y += 4;
      act.sessions.forEach((s, si) => {
        need(8);
        doc.setFont('courier', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 55, 50);
        doc.text(`S${si + 1}`, ml + 2, y); doc.text(s.start || '--:--', ml + 28, y);
        doc.text(s.end || '--:--', ml + 60, y); doc.text(fmt(s.seconds || 0), ml + 92, y); y += 7;
      });
    }
    doc.setDrawColor(200, 195, 190); doc.line(ml, y, W - mr, y); y += 8;
  });

  need(18); y += 2;
  const grand = acts.reduce((s, a) => s + (a.total_seconds || 0), 0);
  doc.setFillColor(212, 80, 10); doc.rect(ml, y, W - ml - mr, 12, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text(`${t('pdf.grandTotal')}: ${fmt(grand)}`, ml + 4, y + 8);

  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
  doc.save(`${t('pdf.filePrefix')}_${stamp}.pdf`);
  showToast(t('pdf.exported'));
}

// ═══════════════════════ GESTIONE ETICHETTE ═══════════════════════
function renderLabelList() {
  const list = document.getElementById('labelList');
  if (!list) return;
  list.innerHTML = '';
  S.labels.forEach(lbl => {
    const row = document.createElement('div'); row.className = 'label-row';

    const colorInp = document.createElement('input');
    colorInp.type = 'color'; colorInp.className = 'label-color-inp';
    colorInp.title = t('account.labelColor');
    colorInp.setAttribute('aria-label', t('account.labelColor'));
    colorInp.value = resolveToHex(lbl.bg);
    colorInp.addEventListener('input', () => {
      lbl.bg = colorInp.value;
      lbl.color = hexToTextColor(colorInp.value);
      refreshAllTimerCatWraps();
    });
    colorInp.addEventListener('change', () => { touchLabels(); renderActivities(); });

    const textInp = document.createElement('input');
    textInp.className = 'label-text-inp'; textInp.type = 'text'; textInp.maxLength = 60;
    textInp.value = lbl.text; textInp.placeholder = t('account.labelPh');
    textInp.setAttribute('aria-label', t('account.labelPh'));
    textInp.addEventListener('change', () => {
      lbl.text = textInp.value.trim() || lbl.text;
      textInp.value = lbl.text;
      touchLabels();
      refreshAllTimerSelects();
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'label-del-btn'; delBtn.textContent = '✕';
    delBtn.title = t('account.labelRemove');
    delBtn.setAttribute('aria-label', t('account.labelRemove'));
    delBtn.addEventListener('click', () => {
      if (S.labels.length <= 1) { showToast(t('account.labelMin')); return; }
      if (!confirm(t('account.confirmLabelDelete', { name: lbl.text }))) return;
      S.labels = S.labels.filter(l => l !== lbl);
      touchLabels();
      renderLabelList();
      refreshAllTimerSelects();
      refreshAllTimerCatWraps();
      showToast(t('account.labelRemoved'));
    });

    row.append(colorInp, textInp, delBtn);
    list.appendChild(row);
  });
}

function addLabel() {
  S.labels.push({ id: 'custom_' + Date.now().toString(36), text: t('account.newLabel'), bg: '#e0dbd3', color: '#1a1714' });
  touchLabels();
  renderLabelList();
  refreshAllTimerSelects();
  showToast(t('account.labelAdded'));
}

function populateLabelSelect(sel, currentValue) {
  sel.innerHTML = '';
  S.labels.forEach(lbl => {
    const opt = document.createElement('option');
    opt.value = lbl.id;
    opt.textContent = lbl.text;
    sel.appendChild(opt);
  });
  sel.value = S.labels.some(l => l.id === currentValue) ? currentValue : (S.labels[0]?.id || '');
}

function applyLabelStyle(wrap, categoryId) {
  if (!wrap) return;
  const lbl = S.labels.find(l => l.id === categoryId) || S.labels[0];
  if (!lbl) return;
  wrap.style.background = lbl.bg;   // i valori var(--…) seguono automaticamente il tema
  wrap.style.color = lbl.color;
}

function refreshAllTimerSelects() {
  for (const ts of timerList()) {
    const card = document.getElementById('tc-' + ts.uid);
    const sel = card?.querySelector('select');
    if (!sel) continue;
    populateLabelSelect(sel, ts.category);
    if (sel.value !== ts.category) { ts.category = sel.value; touchTimer(ts); }
  }
}
function refreshAllTimerCatWraps() {
  for (const ts of timerList()) applyLabelStyle(document.querySelector(`#tc-${CSS.escape(ts.uid)} .tc-cat`), ts.category);
}

function resolveToHex(val) {
  if (!val) return '#cccccc';
  const expand = h => '#' + h.slice(1).split('').map(c => c + c).join('');
  if (/^#[0-9a-f]{6}$/i.test(val)) return val;
  if (/^#[0-9a-f]{3}$/i.test(val)) return expand(val);
  let resolved = val;
  if (val.startsWith('var(')) resolved = getComputedStyle(document.documentElement).getPropertyValue(val.slice(4, -1).trim()).trim();
  if (/^#[0-9a-f]{6}$/i.test(resolved)) return resolved;
  if (/^#[0-9a-f]{3}$/i.test(resolved)) return expand(resolved);
  const m = resolved.match(/\d+/g);
  if (m && m.length >= 3) return '#' + m.slice(0, 3).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('');
  return '#cccccc';
}
function hexToTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 140 ? '#1a1714' : '#f0ede8';
}

// ═══════════════════════ PAGINA ACCOUNT ═══════════════════════
async function loadStats() {
  if (!appUser || !sessionOk) { nav('auth'); return; }
  await syncNow();  // così le statistiche includono anche le ultime attività in coda
  try {
    const d = (await api('get_stats')).data;
    document.getElementById('statActs').textContent = d.total_activities;
    document.getElementById('statTime').textContent = fmtHours(d.total_seconds);
    const member = parseSqlDate(d.member_since);
    const since  = parseSqlDate(d.stats_since);
    const parts = [];
    if (member) parts.push(t('account.memberSince', { date: member.toLocaleDateString(locale()) }));
    if (since)  parts.push(t('account.statsSince',  { date: since.toLocaleDateString(locale()) }));
    document.getElementById('statMember').textContent = parts.join(' · ');
    const unInput = document.getElementById('newUsername');
    if (!unInput.value) unInput.value = d.username || appUser.username;

    const cats = document.getElementById('statCats');
    cats.innerHTML = '';
    (d.by_category || []).forEach(c => {
      const row = document.createElement('div'); row.className = 'cat-row';
      const name = document.createElement('span'); name.textContent = c.category;
      const val = document.createElement('span'); val.className = 'cat-val';
      val.textContent = t('account.catCount', { n: c.cnt, time: fmtHours(c.sec) });
      row.append(name, val);
      cats.appendChild(row);
    });
  } catch (e) { showToast(e.code === 'network' ? t('sync.needOnline') : t('account.statsError')); }
}

async function confirmResetStats() {
  if (!confirm(t('account.confirmResetStats'))) return;
  try {
    await api('reset_stats', {});
    loadStats();
    showToast(t('account.statsReset'));
  } catch (e) { showToast(t('act.error', { msg: e.message })); }
}

async function updateUsername() {
  hideErr('unErr'); hideSuc('unOk');
  const un = document.getElementById('newUsername').value.trim();
  if (!un) { showErr('unErr', t('common.fillAll')); return; }
  try {
    const res = await api('update_profile', { type:'username', username: un });
    appUser.username = res.data.username;
    writeLastUser(appUser);
    updateAuthUI();
    showSuc('unOk');
  } catch (e) { showErr('unErr', e.message); }
}

async function updatePassword() {
  hideErr('pwErr'); hideSuc('pwOk');
  const oldP = document.getElementById('oldPass').value;
  const newP = document.getElementById('newPass').value;
  if (!oldP || !newP) { showErr('pwErr', t('common.fillAll')); return; }
  if (newP.length < PASSWORD_MIN) { showErr('pwErr', t('common.passwordMin', { n: PASSWORD_MIN })); return; }
  try {
    await api('update_profile', { type:'password', old_password: oldP, new_password: newP });
    document.getElementById('oldPass').value = '';
    document.getElementById('newPass').value = '';
    showSuc('pwOk');
  } catch (e) { showErr('pwErr', e.message); }
}

async function deleteAccount() {
  hideErr('delErr');
  const pw = document.getElementById('delPass').value;
  if (!pw) { showErr('delErr', t('account.enterPassword')); return; }
  if (!confirm(t('account.confirmDeleteAccount'))) return;
  try {
    await api('delete_account', { password: pw });
    document.getElementById('delPass').value = '';
    try { localStorage.removeItem(storeKey(appUser)); } catch (e) {}
    writeLastUser(null);
    await switchToGuest({ persist: false });
    nav('home');
    showToast(t('account.deleted'));
  } catch (e) { showErr('delErr', e.message); }
}

// ═══════════════════════ RECUPERO PASSWORD ═══════════════════════
async function requestReset() {
  hideErr('resetErr'); hideSuc('resetOk');
  const un = document.getElementById('resetUser').value.trim();
  if (!un) { showErr('resetErr', t('common.fillAll')); return; }
  try {
    await api('request_reset', { username: un });
    showSuc('resetOk', 8000);
  } catch (e) { showErr('resetErr', e.message); }
}

// ═══════════════════════ API HELPER ═══════════════════════
class ApiError extends Error {
  constructor(code, status) { super(tErr(code)); this.code = code; this.status = status; }
}

/**
 * Chiamata API. Con body → POST (+ token CSRF), senza body → GET.
 * Se il token CSRF è scaduto (es. logout da un'altra scheda) lo rinnova e riprova una volta.
 */
async function api(action, body = null, { keepalive = false, query = '', _retry = false } = {}) {
  const opts = { method: body ? 'POST' : 'GET', credentials: 'same-origin', keepalive, cache: 'no-store' };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify({ ...body, csrf: CSRF_TOKEN });
  }

  let res, data;
  try {
    res = await fetch(`${API}?action=${encodeURIComponent(action)}${query ? '&' + query : ''}`, opts);
    data = await res.json();
  } catch (e) {
    throw new ApiError('network', 0);
  }

  if (data?.error === 'not_authenticated') {
    handleSessionExpired();
    throw new ApiError('not_authenticated', res.status);
  }
  if (data?.error === 'csrf_invalid' && !_retry && action !== 'check') {
    try {
      const chk = await api('check');
      CSRF_TOKEN = chk.data?.csrf || null;
      if (appUser && sessionOk && !chk.data?.logged_in) { handleSessionExpired(); throw new ApiError('not_authenticated', 401); }
    } catch (e) { if (e instanceof ApiError && e.code !== 'network') throw e; }
    return api(action, body, { keepalive, query, _retry: true });
  }
  if (!res.ok || data?.error) throw new ApiError(data?.error || 'server_error', res.status);
  return data;
}

// ═══════════════════════ UTILITÀ ═══════════════════════
function fmt(s) {
  s = Math.max(0, Math.floor(s) || 0);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`;
}
function fmtHours(s) {
  return (s / 3600).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'h';
}
function pad(n) { return String(n).padStart(2, '0'); }
function toHHMM(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
/** Accetta ISO 8601 e "YYYY-MM-DD HH:MM:SS" (Safari non accetta lo spazio). */
function parseSqlDate(s) {
  if (!s) return null;
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d) ? null : d;
}
function formatActDate(s) {
  const d = parseSqlDate(s);
  return d ? d.toLocaleDateString(locale(), { day:'2-digit', month:'2-digit', year:'numeric' }) : '';
}
function autoResize(el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }

function showErr(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}
function hideErr(id) { document.getElementById(id)?.classList.remove('show'); }
function showSuc(id, ms = 3000) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  clearTimeout(el._hideT);
  el._hideT = setTimeout(() => hideSuc(id), ms);
}
function hideSuc(id) { document.getElementById(id)?.classList.remove('show'); }

let toastT = null;
function showToast(msg, ms = 2800) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), ms);
}
