# Changelog — EasyLogger

Il progetto segue il [Semantic Versioning](https://semver.org/lang/it/) `MAJOR.MINOR.PATCH`.
La versione è definita in un unico punto: `public/config/app.php` → `APP_VERSION`.

## [4.0.0] — 2026-09-24

MAJOR: cambiano il protocollo di sincronizzazione e lo schema dei timer (le API 3.x per attività, timer ed
etichette sono state sostituite da `push` / `sync`). Serve `sql/migrate_3.3.0_to_4.0.0.sql`.

### Aggiunto
- **Salvataggio local-first con coda di invio**: attività, timer ed etichette vengono salvati subito sul
  device e inviati al server appena possibile. Salvare un'attività non può più fallire, nemmeno offline.
- **Idempotenza**: ogni attività/timer ha un `uid` generato dal client; i reinvii non creano duplicati.
- **Sync incrementale** per revisione (`sync?since=N`) con snapshot consistente e tombstone per le eliminazioni.
- **Timer come record singoli** (tabella `easylogger_timers`) con controllo di versione: le modifiche
  concorrenti da due device vengono rilevate invece di sovrascriversi; l'utente viene avvisato.
- **Service worker** (`sw.php`): la PWA funziona offline; cache rinnovata ad ogni versione.
- Badge di stato della sincronizzazione nella barra in alto; attività "da sincronizzare" evidenziate.
- Uso offline con l'ultimo account: al ritorno della rete la coda parte da sola; se la sessione è scaduta
  basta rifare il login e le modifiche vengono inviate.
- Conversione automatica dei timer 3.x e dei dati ospite salvati nel browser.

### Modificato
- Date delle attività scambiate in ISO 8601 con fuso orario (niente più ambiguità tra server e device).
- Il logout con modifiche non ancora inviate chiede conferma e le conserva sul device.
- Sync automatica ogni 30 s (prima 60 s) ma solo con delta: molto meno traffico.

### Rimosso
- Endpoint `get_activities`, `save_activity`, `update_activity`, `delete_activity`, `get_labels`,
  `save_labels`, `get_timers`, `save_timers` (sostituiti da `push` e `sync`).

## [3.3.0] — 2026-09-24

### Aggiunto
- Voce di menu **Ricarica e sincronizza** (sotto il selettore della lingua): invia le modifiche in sospeso,
  scarta la cache locale e ricarica la pagina rileggendo tutto dal database.
- Sincronizzazione automatica tra device: ogni 60 s con l'app visibile, al ritorno in primo piano e al ritorno
  della connessione. Non sovrascrive modifiche locali non ancora inviate né campi in cui si sta scrivendo.
- Endpoint `sync`: attività, etichette e timer in un'unica richiesta.
- `sql/migrate_3.2.x_to_3.3.0.sql`.

### Corretto
- **Attività che "sparivano" dopo logout/login e non comparivano sugli altri device.** Erano salvate nel DB,
  ma il logout impostava `list_cleared_at` a livello di utente e le nascondeva su tutti i device.
  Ora il logout non nasconde più nulla; la lista si svuota solo con "Reset lista".
- Le modifiche alle attività in attesa di invio vengono spedite anche alla chiusura/messa in background dell'app.

 — 2026-09-24

### Modificato
- Pagina About: il link testuale "Fai una donazione" è ora un pulsante che punta a https://www.sputlab.com/donate.

## [3.2.0] — 2026-09-24

### Aggiunto
- **Lingua inglese** in tutta l'app (interfaccia, messaggi, errori del server, PDF, pagina di reset password).
  Selettore nel menu, lingua rilevata dal browser al primo avvio e salvata nel profilo utente (colonna `lang`).
- Data dell'attività nelle card e nel PDF.
- Endpoint `clear_list`: "Reset lista" ora è persistente anche per gli utenti registrati.
- Rate limiting per IP su DB (login, registrazione, reset e cambio password) — tabella `easylogger_rate_limits`.
- Banner per l'utente ospite, keep-alive della sessione, focus visibile e attributi di accessibilità.
- `CHANGELOG.md`, `README.md`, script di installazione e migrazione in `sql/`.

### Modificato
- **Tutte le tabelle hanno il prefisso `easylogger_`** (costante `DB_PREFIX` in `config/app.php`).
- Passaggio al versioning `MAJOR.MINOR.PATCH` (3.1 → 3.1.0 → **3.2.0**).
- `last_logout_at` rinominata in `list_cleared_at` (usata da logout e "Reset lista").
- CSS e JavaScript spostati in `assets/` (prima inline in `index.php`), con cache-busting `?v=versione`.
- Credenziali DB spostate in `config/config.local.php` (escluso dal versioning).
- Timer salvati sul server solo quando cambiano (prima: una richiesta ogni 5 secondi).
- Password minima portata a 8 caratteri per le nuove password (le esistenti continuano a funzionare).
- L'API restituisce codici di errore tradotti dal client; i dettagli tecnici finiscono solo nel log.
- jsPDF aggiornato a 2.5.1.

### Corretto
- Schema `install.sql` non allineato al codice (mancavano `user_labels`, `user_timers`, `category_text`,
  `last_logout_at`, `stats_reset_at`) e `timer_id` troppo corto (errore "Data too long for column 'timer_id'").
- `.htaccess` non attivo (si chiamava `old.htaccess`, con `RewriteBase` errato): `install.sql` e `logs/errors.log`
  erano scaricabili pubblicamente.
- XSS nelle statistiche per categoria (testo etichetta inserito con `innerHTML`).
- Azioni che modificano dati (`reset_stats`, `logout`) eseguibili via GET senza token CSRF.
- Salvataggio di un timer in corso fallito → tempo contato due volte e timer bloccato.
- Doppio clic su "Salva" → attività duplicate.
- Al login non venivano caricati etichette e timer dell'account, e i timer ospite sovrascrivevano quelli sul server.
- Dopo l'eliminazione dell'account il token CSRF non veniva rinnovato (errori "CSRF non valido").
- Etichette predefinite con i colori del tema chiaro anche in tema scuro.
- Campo "Nuovo username" che mostrava "undefined".
- Data "Membro dal" non valida su Safari.
- "Reset lista" che per gli utenti registrati ricompariva al ricaricamento della pagina.
- Il recupero password diceva "Email inviata!" ma nessuna email veniva mai inviata.
- Timer in pausa che eseguivano comunque il tick ogni secondo.
- Messaggio fuorviante nella conferma "Azzera statistiche".
- Manifest/HTML: icona 48×48 e apple-touch-icon 76/120 inesistenti, titolo iOS "EasyPass", `theme-color` incoerente.
- Rimossi `style.css` duplicato e non usato, file `.DS_Store` e `__MACOSX`.

## [3.1.0]
- Versione precedente (numerata "3.1").
