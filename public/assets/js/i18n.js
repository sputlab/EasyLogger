// ═══════════════════════════════════════════════════════════════
//  EasyLogger — Internazionalizzazione / Internationalization
//  Per aggiungere una lingua: aggiungi un blocco a I18N con le stesse chiavi.
// ═══════════════════════════════════════════════════════════════

const I18N = {
  it: {
    'lang.name': 'Italiano',
    'lang.switch': 'English',
    'lang.switchIcon': '🇬🇧',

    // Drawer
    'menu.title': 'Menu',
    'menu.theme': 'Tema scuro/chiaro',
    'menu.language': 'Lingua: Italiano',
    'menu.login': 'Accedi / Registrati',
    'menu.account': 'Il mio account',
    'menu.logout': 'Esci',
    'menu.about': 'Informazioni su EasyLogger',
    'menu.sync': 'Ricarica e sincronizza',
    'sync.running': '🔄 Sincronizzazione in corso…',
    'sync.done': '✅ Dati sincronizzati dal server',
    'sync.stillPending': '⏳ Ricaricato. {n} modifiche verranno inviate appena possibile',
    'sync.pendingLogin': '⏳ {n} modifiche di {name} non ancora sincronizzate: accedi per inviarle',
    'sync.conflict': '⚠️ {n} elementi modificati da un altro dispositivo: mostrata la versione più recente',
    'sync.logoutPending': 'Ci sono {n} modifiche non ancora sincronizzate (sei offline?).\n\nResteranno salvate su questo dispositivo e verranno inviate al prossimo accesso. Uscire comunque?',
    'sync.badgeOffline': '📴 offline',
    'sync.badgeOfflineN': '📴 offline · {n}',
    'sync.badgePending': '⏳ {n}',
    'sync.badgeSyncing': '🔄',
    'sync.badgeLogin': '🔒 accedi',
    'sync.notSynced': 'da sincronizzare',
    'sync.notSyncedTitle': 'Salvata su questo dispositivo, verrà inviata al server appena possibile',
    'sync.needLogin': '🔒 Accedi di nuovo per questa operazione',
    'sync.needOnline': '📴 Serve la connessione per questa operazione',
    'sw.updated': '✨ Nuova versione installata: usa «Ricarica e sincronizza» per applicarla',
    'menu.close': 'Chiudi menu',
    'menu.open': 'Apri menu',

    // Auth
    'auth.login.title': 'Accedi',
    'auth.login.sub': 'Bentornato su EasyLogger',
    'auth.login.submit': 'Accedi',
    'auth.login.switchText': 'Non hai un account?',
    'auth.login.switchBtn': 'Registrati',
    'auth.register.title': 'Registrati',
    'auth.register.sub': 'Crea il tuo account EasyLogger',
    'auth.register.submit': 'Crea account',
    'auth.register.switchText': 'Hai già un account?',
    'auth.register.switchBtn': 'Accedi',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.usernamePh': 'il_tuo_username',
    'auth.forgot': 'Password dimenticata?',
    'auth.hello': '👋 Ciao {name}!',
    'auth.bye': '👋 Disconnesso',
    'auth.localImported': '☁️ {n} attività locali sincronizzate',

    // Reset
    'reset.title': 'Recupera password',
    'reset.sub': 'Inserisci il tuo username',
    'reset.submit': 'Invia richiesta',
    'reset.ok': 'Richiesta registrata. Contatta l\'amministratore per ricevere il link di reimpostazione.',
    'reset.back': '← Torna al login',
    'reset.page.title': 'Reimposta la password',
    'reset.page.new': 'Nuova password',
    'reset.page.confirm': 'Conferma password',
    'reset.page.submit': 'Conferma',
    'reset.page.mismatch': 'Le password non coincidono',
    'reset.page.done': 'Password aggiornata! Ora puoi accedere.',
    'reset.page.goApp': 'Vai a EasyLogger',
    'reset.page.noToken': 'Link non valido: token mancante.',

    // Home
    'home.newTimer': '＋ Nuovo timer',
    'home.total': 'Durata totale',
    'home.resetList': '🗑 Reset lista',
    'home.exportPdf': '↓ Esporta PDF',
    'home.activities': 'Attività registrate',
    'home.empty': 'Nessuna attività.<br>Avvia un timer per iniziare.',
    'home.guestHint': 'Stai usando EasyLogger senza account: i dati restano solo in questo browser.',
    'home.guestHintBtn': 'Accedi per sincronizzarli',

    // Timer
    'timer.descPh': 'Descrizione attività…',
    'timer.remove': 'Rimuovi timer',
    'timer.start': '▶ Avvia',
    'timer.pause': '⏸ Pausa',
    'timer.resume': '▶ Riprendi',
    'timer.save': '💾 Salva',
    'timer.discard': '⟳ Scarta',
    'timer.running': 'sessione {n} — {time}',
    'timer.paused': 'in pausa — {n} sess. completate',
    'timer.live': 'S{n} in corso…',
    'timer.noTime': '⚠️ Nessun tempo registrato',
    'timer.untitled': 'Attività senza titolo',
    'timer.saved': '✅ Attività salvata',
    'timer.saveError': '⚠️ Errore salvataggio: {msg}',
    'timer.confirmDiscard': 'Scartare questo timer?',
    'timer.discarded': '🗑 Timer scartato',
    'timer.confirmRemove': 'Questo timer ha tempo registrato. Eliminandolo perderai i dati. Continuare?',
    'timer.removed': '🗑 Timer rimosso',
    'timer.label': 'Etichetta',

    // Activities
    'act.descPh': 'Descrizione attività',
    'act.sessions': 'Sessioni',
    'act.total': 'totale',
    'act.addSession': '+ Sessione',
    'act.delete': 'Elimina',
    'act.sessionAdded': '➕ Sessione aggiunta',
    'act.sessionDeleted': '🗑 Sessione eliminata',
    'act.deleteSession': 'Elimina sessione',
    'act.confirmDelete': 'Eliminare questa attività?',
    'act.deleted': '🗑 Attività eliminata',
    'act.syncFailed': '⚠️ Sincronizzazione fallita',
    'act.error': '⚠️ Errore: {msg}',
    'act.start': 'Inizio',
    'act.end': 'Fine',
    'act.confirmResetList': 'Cancellare tutte le attività dalla lista su tutti i tuoi dispositivi?\n\nLe attività restano nel database e le statistiche rimarranno intatte.',
    'act.confirmResetListGuest': 'Cancellare tutte le attività dalla lista?\n\nSenza account le attività verranno eliminate definitivamente.',
    'act.listCleared': '🗑 Lista cancellata',

    // PDF
    'pdf.title': 'EasyLogger — Report attività',
    'pdf.total': 'TOTALE',
    'pdf.sess': 'SESS.',
    'pdf.start': 'INIZIO',
    'pdf.end': 'FINE',
    'pdf.duration': 'DURATA',
    'pdf.grandTotal': 'Durata totale',
    'pdf.exported': '📄 PDF esportato',
    'pdf.noActivities': '⚠️ Nessuna attività da esportare',
    'pdf.libMissing': '⚠️ Libreria PDF non disponibile (sei offline?)',
    'pdf.filePrefix': 'easylogger_report',

    // Account
    'account.back': '← Indietro',
    'account.title': 'Il mio account',
    'account.stats': '📊 Statistiche',
    'account.totalActs': 'Attività totali',
    'account.hours': 'Ore registrate',
    'account.memberSince': 'Membro dal {date}',
    'account.statsSince': 'Statistiche dal {date}',
    'account.resetStats': '🔄 Azzera statistiche',
    'account.confirmResetStats': 'Azzerare tutte le statistiche?\n\nLe attività non vengono eliminate: il conteggio ripartirà da zero da adesso.',
    'account.statsReset': '🔄 Statistiche azzerate',
    'account.statsError': '⚠️ Errore caricamento statistiche',
    'account.catCount': '{n} attività · {time}',
    'account.labels': '🏷️ Etichette personalizzate',
    'account.labelsHint': 'Modifica le etichette disponibili nei timer. Le modifiche si applicano subito ai timer; le attività già salvate mantengono il nome dell\'etichetta di quel momento.',
    'account.addLabel': '＋ Aggiungi etichetta',
    'account.labelPh': 'Nome etichetta',
    'account.labelColor': 'Scegli colore',
    'account.labelRemove': 'Rimuovi etichetta',
    'account.labelMin': '⚠️ Serve almeno un\'etichetta',
    'account.confirmLabelDelete': 'Eliminare l\'etichetta "{name}"?',
    'account.labelRemoved': '🗑 Etichetta rimossa',
    'account.labelAdded': '➕ Etichetta aggiunta',
    'account.newLabel': 'Nuova etichetta',
    'account.changeUsername': '✏️ Cambia username',
    'account.newUsername': 'Nuovo username',
    'account.newUsernamePh': 'Inserisci il nuovo username',
    'account.usernameOk': 'Username aggiornato!',
    'account.saveUsername': 'Salva username',
    'account.changePassword': '🔑 Cambia password',
    'account.currentPassword': 'Password attuale',
    'account.newPassword': 'Nuova password',
    'account.passwordOk': 'Password aggiornata!',
    'account.savePassword': 'Cambia password',
    'account.danger': '⚠️ Zona pericolosa',
    'account.dangerText': 'Eliminare l\'account cancella definitivamente tutti i tuoi dati. L\'operazione è irreversibile.',
    'account.confirmWithPassword': 'Conferma con la tua password',
    'account.deleteAccount': 'Elimina il mio account',
    'account.enterPassword': 'Inserisci la password',
    'account.confirmDeleteAccount': 'Sei SICURO di voler eliminare il tuo account? Tutti i dati saranno persi definitivamente.',
    'account.deleted': '👋 Account eliminato',

    // Default labels
    'label.lavoro': 'Lavoro',
    'label.sviluppo': 'Sviluppo',
    'label.riunione': 'Riunione',
    'label.pausa': 'Pausa',
    'label.altro': 'Altro',

    // About
    'about.version': 'versione {v} · by sputlab.com',
    'about.p1': 'EasyLogger è un time tracker minimalista pensato per chi vuole registrare le proprie attività in modo semplice e veloce, senza distrazioni.',
    'about.p2': 'Avvia più timer contemporaneamente, metti in pausa, riprendi, modifica i dettagli di ogni sessione e tieni traccia del tuo tempo nel modo che preferisci.',
    'about.support': 'Supporta lo sviluppo di EasyLogger',
    'about.donate': '❤️ Fai una donazione',
    'about.f1': 'Timer multipli indipendenti con pausa/riprendi',
    'about.f2': 'Sessioni multiple per attività con orari modificabili',
    'about.f3': 'Sincronizzazione tra dispositivi, anche offline',
    'about.f4': 'Export PDF del log attività',
    'about.f5': 'Tema chiaro e scuro',
    'about.f6': 'Interfaccia in italiano e inglese',
    'about.f7': 'Installabile come app (PWA), per mobile e desktop',

    // Generic
    'common.fillAll': 'Compila tutti i campi',
    'common.passwordMin': 'La password deve essere di almeno {n} caratteri',
    'common.sessionExpired': '🔒 Sessione scaduta. Effettua nuovamente il login.',

    // Server error codes
    'err.not_authenticated': 'Non autenticato',
    'err.method_not_allowed': 'Metodo non consentito',
    'err.invalid_action': 'Azione non valida',
    'err.csrf_invalid': 'Sessione non valida, riprova',
    'err.fields_required': 'Compila tutti i campi',
    'err.too_many_attempts': 'Troppi tentativi, riprova più tardi',
    'err.invalid_credentials': 'Credenziali errate',
    'err.username_invalid': 'Username non valido (3–30 caratteri: lettere, numeri, _ . -)',
    'err.password_too_short': 'Password troppo corta (min {n} caratteri)',
    'err.username_taken': 'Username già in uso',
    'err.token_invalid': 'Link non valido o scaduto',
    'err.old_password_wrong': 'Password attuale errata',
    'err.password_wrong': 'Password errata',
    'err.invalid_type': 'Richiesta non valida',
    'err.label_required': 'Serve almeno un\'etichetta',
    'err.payload_too_large': 'Dati troppo grandi',
    'err.server_error': 'Errore del server, riprova',
    'err.network': 'Errore di rete: controlla la connessione',
  },

  en: {
    'lang.name': 'English',
    'lang.switch': 'Italiano',
    'lang.switchIcon': '🇮🇹',

    'menu.title': 'Menu',
    'menu.theme': 'Dark/light theme',
    'menu.language': 'Language: English',
    'menu.login': 'Log in / Sign up',
    'menu.account': 'My account',
    'menu.logout': 'Log out',
    'menu.about': 'About EasyLogger',
    'menu.sync': 'Reload & sync',
    'sync.running': '🔄 Syncing…',
    'sync.done': '✅ Data synced from the server',
    'sync.stillPending': '⏳ Reloaded. {n} changes will be sent as soon as possible',
    'sync.pendingLogin': '⏳ {n} changes by {name} not synced yet: log in to send them',
    'sync.conflict': '⚠️ {n} items were changed on another device: showing the latest version',
    'sync.logoutPending': 'There are {n} changes not synced yet (are you offline?).\n\nThey will stay on this device and be sent at your next login. Log out anyway?',
    'sync.badgeOffline': '📴 offline',
    'sync.badgeOfflineN': '📴 offline · {n}',
    'sync.badgePending': '⏳ {n}',
    'sync.badgeSyncing': '🔄',
    'sync.badgeLogin': '🔒 log in',
    'sync.notSynced': 'not synced',
    'sync.notSyncedTitle': 'Saved on this device, it will be sent to the server as soon as possible',
    'sync.needLogin': '🔒 Please log in again for this action',
    'sync.needOnline': '📴 This action needs a connection',
    'sw.updated': '✨ New version installed: use “Reload & sync” to apply it',
    'menu.close': 'Close menu',
    'menu.open': 'Open menu',

    'auth.login.title': 'Log in',
    'auth.login.sub': 'Welcome back to EasyLogger',
    'auth.login.submit': 'Log in',
    'auth.login.switchText': 'Don\'t have an account?',
    'auth.login.switchBtn': 'Sign up',
    'auth.register.title': 'Sign up',
    'auth.register.sub': 'Create your EasyLogger account',
    'auth.register.submit': 'Create account',
    'auth.register.switchText': 'Already have an account?',
    'auth.register.switchBtn': 'Log in',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.usernamePh': 'your_username',
    'auth.forgot': 'Forgot your password?',
    'auth.hello': '👋 Hi {name}!',
    'auth.bye': '👋 Logged out',
    'auth.localImported': '☁️ {n} local activities synced',

    'reset.title': 'Recover password',
    'reset.sub': 'Enter your username',
    'reset.submit': 'Send request',
    'reset.ok': 'Request received. Contact the administrator to get your reset link.',
    'reset.back': '← Back to login',
    'reset.page.title': 'Reset your password',
    'reset.page.new': 'New password',
    'reset.page.confirm': 'Confirm password',
    'reset.page.submit': 'Confirm',
    'reset.page.mismatch': 'Passwords do not match',
    'reset.page.done': 'Password updated! You can now log in.',
    'reset.page.goApp': 'Go to EasyLogger',
    'reset.page.noToken': 'Invalid link: missing token.',

    'home.newTimer': '＋ New timer',
    'home.total': 'Total duration',
    'home.resetList': '🗑 Clear list',
    'home.exportPdf': '↓ Export PDF',
    'home.activities': 'Logged activities',
    'home.empty': 'No activities yet.<br>Start a timer to begin.',
    'home.guestHint': 'You are using EasyLogger without an account: data is stored only in this browser.',
    'home.guestHintBtn': 'Log in to sync it',

    'timer.descPh': 'Activity description…',
    'timer.remove': 'Remove timer',
    'timer.start': '▶ Start',
    'timer.pause': '⏸ Pause',
    'timer.resume': '▶ Resume',
    'timer.save': '💾 Save',
    'timer.discard': '⟳ Discard',
    'timer.running': 'session {n} — {time}',
    'timer.paused': 'paused — {n} sessions completed',
    'timer.live': 'S{n} running…',
    'timer.noTime': '⚠️ No time recorded',
    'timer.untitled': 'Untitled activity',
    'timer.saved': '✅ Activity saved',
    'timer.saveError': '⚠️ Save error: {msg}',
    'timer.confirmDiscard': 'Discard this timer?',
    'timer.discarded': '🗑 Timer discarded',
    'timer.confirmRemove': 'This timer has recorded time. Removing it will lose the data. Continue?',
    'timer.removed': '🗑 Timer removed',
    'timer.label': 'Label',

    'act.descPh': 'Activity description',
    'act.sessions': 'Sessions',
    'act.total': 'total',
    'act.addSession': '+ Session',
    'act.delete': 'Delete',
    'act.sessionAdded': '➕ Session added',
    'act.sessionDeleted': '🗑 Session deleted',
    'act.deleteSession': 'Delete session',
    'act.confirmDelete': 'Delete this activity?',
    'act.deleted': '🗑 Activity deleted',
    'act.syncFailed': '⚠️ Sync failed',
    'act.error': '⚠️ Error: {msg}',
    'act.start': 'Start',
    'act.end': 'End',
    'act.confirmResetList': 'Clear all activities from the list on all your devices?\n\nActivities stay in the database and your statistics remain intact.',
    'act.confirmResetListGuest': 'Clear all activities from the list?\n\nWithout an account the activities will be permanently deleted.',
    'act.listCleared': '🗑 List cleared',

    'pdf.title': 'EasyLogger — Activity report',
    'pdf.total': 'TOTAL',
    'pdf.sess': 'SESS.',
    'pdf.start': 'START',
    'pdf.end': 'END',
    'pdf.duration': 'DURATION',
    'pdf.grandTotal': 'Total duration',
    'pdf.exported': '📄 PDF exported',
    'pdf.noActivities': '⚠️ No activities to export',
    'pdf.libMissing': '⚠️ PDF library unavailable (are you offline?)',
    'pdf.filePrefix': 'easylogger_report',

    'account.back': '← Back',
    'account.title': 'My account',
    'account.stats': '📊 Statistics',
    'account.totalActs': 'Total activities',
    'account.hours': 'Hours logged',
    'account.memberSince': 'Member since {date}',
    'account.statsSince': 'Statistics since {date}',
    'account.resetStats': '🔄 Reset statistics',
    'account.confirmResetStats': 'Reset all statistics?\n\nActivities are not deleted: counting will restart from zero as of now.',
    'account.statsReset': '🔄 Statistics reset',
    'account.statsError': '⚠️ Error loading statistics',
    'account.catCount': '{n} activities · {time}',
    'account.labels': '🏷️ Custom labels',
    'account.labelsHint': 'Edit the labels available in timers. Changes apply to timers immediately; saved activities keep the label name they had when saved.',
    'account.addLabel': '＋ Add label',
    'account.labelPh': 'Label name',
    'account.labelColor': 'Pick a colour',
    'account.labelRemove': 'Remove label',
    'account.labelMin': '⚠️ At least one label is required',
    'account.confirmLabelDelete': 'Delete the label "{name}"?',
    'account.labelRemoved': '🗑 Label removed',
    'account.labelAdded': '➕ Label added',
    'account.newLabel': 'New label',
    'account.changeUsername': '✏️ Change username',
    'account.newUsername': 'New username',
    'account.newUsernamePh': 'Enter the new username',
    'account.usernameOk': 'Username updated!',
    'account.saveUsername': 'Save username',
    'account.changePassword': '🔑 Change password',
    'account.currentPassword': 'Current password',
    'account.newPassword': 'New password',
    'account.passwordOk': 'Password updated!',
    'account.savePassword': 'Change password',
    'account.danger': '⚠️ Danger zone',
    'account.dangerText': 'Deleting your account permanently erases all your data. This cannot be undone.',
    'account.confirmWithPassword': 'Confirm with your password',
    'account.deleteAccount': 'Delete my account',
    'account.enterPassword': 'Enter your password',
    'account.confirmDeleteAccount': 'Are you SURE you want to delete your account? All data will be permanently lost.',
    'account.deleted': '👋 Account deleted',

    'label.lavoro': 'Work',
    'label.sviluppo': 'Development',
    'label.riunione': 'Meeting',
    'label.pausa': 'Break',
    'label.altro': 'Other',

    'about.version': 'version {v} · by sputlab.com',
    'about.p1': 'EasyLogger is a minimalist time tracker for anyone who wants to log their activities quickly and simply, without distractions.',
    'about.p2': 'Run several timers at once, pause, resume, edit the details of each session and keep track of your time the way you like.',
    'about.support': 'Support EasyLogger development',
    'about.donate': '❤️ Make a donation',
    'about.f1': 'Multiple independent timers with pause/resume',
    'about.f2': 'Multiple sessions per activity with editable times',
    'about.f3': 'Sync across devices, even offline',
    'about.f4': 'PDF export of the activity log',
    'about.f5': 'Light and dark theme',
    'about.f6': 'Italian and English interface',
    'about.f7': 'Installable as an app (PWA), for mobile and desktop',

    'common.fillAll': 'Please fill in all fields',
    'common.passwordMin': 'Password must be at least {n} characters',
    'common.sessionExpired': '🔒 Session expired. Please log in again.',

    'err.not_authenticated': 'Not authenticated',
    'err.method_not_allowed': 'Method not allowed',
    'err.invalid_action': 'Invalid action',
    'err.csrf_invalid': 'Invalid session, please try again',
    'err.fields_required': 'Please fill in all fields',
    'err.too_many_attempts': 'Too many attempts, please try again later',
    'err.invalid_credentials': 'Wrong username or password',
    'err.username_invalid': 'Invalid username (3–30 characters: letters, numbers, _ . -)',
    'err.password_too_short': 'Password too short (min {n} characters)',
    'err.username_taken': 'Username already taken',
    'err.token_invalid': 'Invalid or expired link',
    'err.old_password_wrong': 'Current password is wrong',
    'err.password_wrong': 'Wrong password',
    'err.invalid_type': 'Invalid request',
    'err.label_required': 'At least one label is required',
    'err.payload_too_large': 'Data too large',
    'err.server_error': 'Server error, please try again',
    'err.network': 'Network error: check your connection',
  },
};

const SUPPORTED_LANGS = Object.keys(I18N);
const PASSWORD_MIN = 8; // deve coincidere con PASSWORD_MIN in config/app.php

let currentLang = detectLang();

function detectLang() {
  try {
    const saved = localStorage.getItem('el_lang');
    if (saved && I18N[saved]) return saved;
  } catch (e) {}
  const nav = (navigator.language || 'it').slice(0, 2).toLowerCase();
  return I18N[nav] ? nav : 'it';
}

/** Traduce una chiave sostituendo i parametri {nome}. */
function t(key, params = {}) {
  const dict = I18N[currentLang] || I18N.it;
  let s = dict[key] ?? I18N.it[key] ?? key;
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Traduce un codice di errore restituito dall'API. */
function tErr(code) {
  const key = 'err.' + code;
  const dict = I18N[currentLang] || I18N.it;
  if (dict[key] === undefined && I18N.it[key] === undefined) return code;
  return t(key, { n: PASSWORD_MIN });
}

/** Locale per le date (it-IT / en-GB). */
function locale() { return currentLang === 'en' ? 'en-GB' : 'it-IT'; }

/** Applica le traduzioni agli elementi con data-i18n / data-i18n-html / -placeholder / -title / -aria. */
function applyI18n(root = document) {
  document.documentElement.lang = currentLang;
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}

function setLang(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  try { localStorage.setItem('el_lang', lang); } catch (e) {}
  applyI18n();
}
