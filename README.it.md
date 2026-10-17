# EasyLogger

[![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)](CHANGELOG.md)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![PHP](https://img.shields.io/badge/PHP-8.0%2B-777bb4.svg)](https://www.php.net/)
[![Database](https://img.shields.io/badge/Database-MySQL%20%7C%20MariaDB-orange.svg)](https://mariadb.org/)
[![PWA](https://img.shields.io/badge/PWA-offline--first-green.svg)](public/manifest.json)

> Time tracker web multi-timer minimalista e Progressive Web App (PWA) local-first.  
> Sviluppato con HTML5, JS vanilla, PHP 8+ e MySQL/MariaDB. Creato da [sputlab.com](https://www.sputlab.com).  
> Interfaccia bilingue in **italiano** e **inglese**.

[🇬🇧 **Read documentation in English**](README.md)

---

## ✨ Caratteristiche

- ⏱️ **Multi-Timer** — Crea, metti in pausa e gestisci più timer contemporaneamente.
- 📴 **Local-First e Offline (PWA)** — Grazie al Service Worker dedicato (`sw.php`) l'app funziona anche senza connessione internet. Ogni modifica viene salvata subito in locale e accodata per la trasmissione al server.
- 🔄 **Sincronizzazione incrementale affidabile**:
  - **Idempotenza**: ogni attività e timer ha un `uid` generato dal client (eventuali reinvii dovuti a cadute di rete non creano duplicati).
  - **Delta sync** (`sync?since=N`): scarica solo le modifiche successive alla revisione locale `N` tramite un contatore di revisione monotono per utente.
  - **Cancellazioni con tombstone**: conservate per 90 giorni prima dell'eliminazione fisica.
  - **Controllo di concorrenza ottimistico**: confronto della `version` del record per rilevare modifiche concorrenti su dispositivi diversi.
  - Sincronizzazione automatica ad ogni modifica, ogni 30 s ad app aperta, al ritorno in primo piano e alla riconnessione della rete.
- 🏷️ **Etichette e categorie personalizzate** — Organizza le attività con colori e nomi a scelta.
- 📊 **Storico attività ed esportazione PDF** — Genera riepiloghi PDF impaginati direttamente dal browser (tramite jsPDF).
- 🌐 **Internazionalizzazione (i18n)** — Rilevamento automatico della lingua del browser con selettore manuale.
- 🌓 **Tema Chiaro / Scuro** — Rilevamento automatico del tema di sistema e cambio manuale.
- 🔒 **Sicurezza**:
  - Cookie di sessione sicuri (`SameSite=Strict`, `HttpOnly`, `Secure`).
  - Header HTTP di sicurezza (CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
  - Rate limiting su database per IP per proteggere endpoint sensibili (login, registrazione, reset password).
  - Protezione CSRF su tutte le operazioni in scrittura.
  - Separazione tra cartella pubblica (`public/`) e logica di backend / file SQL.

---

## 📁 Struttura della repository

```
.
├── .github/                 # Template di issue e workflow di CI GitHub Actions
├── public/                  # DocumentRoot del web server (file esposti al web)
│   ├── assets/
│   │   ├── css/style.css    # Fogli di stile responsive (tema chiaro e scuro)
│   │   └── js/
│   │       ├── app.js       # Logica applicativa e motore di sync
│   │       └── i18n.js      # Traduzioni (italiano e inglese)
│   ├── config/
│   │   ├── app.php          # Costanti, prefisso tabelle, regole account
│   │   ├── config.local.php # Credenziali DB locali (NON versionare)
│   │   ├── config.sample.php# Esempio di configurazione
│   │   └── db.php           # Gestore connessione PDO (supporta variabili d'ambiente)
│   ├── favicon/             # Favicon standard
│   ├── icons/               # Icone PWA a varie risoluzioni
│   ├── inc/
│   │   └── sync.php         # Motore di sincronizzazione server-side
│   ├── logs/                # Cartella log protetta da .htaccess
│   ├── api.php              # API REST JSON
│   ├── index.php            # Entrypoint dell'applicazione web
│   ├── manifest.json        # Web App Manifest PWA
│   ├── reset.php            # Pagina di reimpostazione password
│   └── sw.php               # Service Worker con cache-busting automatico
├── resources/               # Asset grafici originali (SVG vettoriale)
├── sql/
│   ├── install.sql          # Schema per installazione pulita
│   ├── migrate_3.1.0_to_3.2.0.sql
│   ├── migrate_3.2.x_to_3.3.0.sql
│   └── migrate_3.3.0_to_4.0.0.sql
├── CHANGELOG.md             # Storico delle versioni
├── CONTRIBUTING.md          # Linee guida per contribuire
├── LICENSE                  # Licenza GNU General Public License v3
├── README.md                # Documentazione in inglese
└── README.it.md             # Documentazione in italiano
```

---

## 🚀 Requisiti

- **PHP**: `>= 8.0` con estensioni `pdo_mysql`, `json` e `session` abilitate.
- **Database**: **MySQL** `>= 5.7` o **MariaDB** `>= 10.3` (supporto InnoDB e `utf8mb4`).
- **Web Server**: **Apache** (moduli `mod_rewrite`, `mod_headers`, `mod_expires` abilitati) oppure **Nginx**.
- **HTTPS**: Obbligatorio per abilitare il Service Worker della PWA (tranne in ambiente `localhost`).

---

## 🛠️ Installazione

### 1. Clonare la repository
```bash
git clone https://github.com/your-username/EasyLogger.git
cd EasyLogger
```

### 2. Creare il Database
Importa lo schema pulito nel tuo database MySQL/MariaDB:
```bash
mysql -u tuo_utente -p tuo_database < sql/install.sql
```

### 3. Configurazione credenziali
Copia `public/config/config.sample.php` in `public/config/config.local.php`:
```bash
cp public/config/config.sample.php public/config/config.local.php
```
Modifica `public/config/config.local.php` con le tue credenziali:
```php
<?php
return [
  'db_host' => '127.0.0.1',
  'db_name' => 'tuo_database',
  'db_user' => 'tuo_utente',
  'db_pass' => 'tua_password',
];
```

> [!TIP]
> **Variabili d'ambiente**: È possibile configurare le variabili d'ambiente `DB_HOST`, `DB_NAME`, `DB_USER` e `DB_PASS`. Se impostate, hanno la precedenza sui valori definiti in `config.local.php`.

### 4. Configurazione del Web Server

#### Metodo A: DocumentRoot puntata su `public/` (Consigliato)
Configura il virtual host per servire la sottocartella `public/`:

**Esempio per Apache VirtualHost:**
```apache
<VirtualHost *:443>
    ServerName easylogger.example.com
    DocumentRoot /var/www/EasyLogger/public

    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/privkey.pem

    <Directory /var/www/EasyLogger/public>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

**Esempio per Nginx:**
```nginx
server {
    listen 443 ssl http2;
    server_name easylogger.example.com;
    root /var/www/EasyLogger/public;
    index index.php;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    location ~* (^#.*#|\.(bak|config|dist|fla|inc|ini|log|psd|sh|sql|sw[op]|sample)|~)$ {
        deny all;
    }
    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

#### Metodo B: Installazione in sottocartella o DocumentRoot su root
Se il web server punta alla root del repository o a una sottocartella (es. `https://example.com/easylogger/`), il file `.htaccess` principale inoltrerà automaticamente le richieste verso `public/`.

---

## 🐳 Avvio rapido con Docker

Puoi provare EasyLogger localmente tramite Docker Compose:

```bash
docker compose up -d
```
Quindi apri il browser su `http://localhost:8080`.

---

## 🔄 Aggiornamento a 4.0.0

1. **Backup del database.**
2. Esegui in ordine gli script di migrazione necessari:
   - Da 3.1.x: `sql/migrate_3.1.0_to_3.2.0.sql` &rarr; `sql/migrate_3.2.x_to_3.3.0.sql` &rarr; `sql/migrate_3.3.0_to_4.0.0.sql`
   - Da 3.2.x: `sql/migrate_3.2.x_to_3.3.0.sql` &rarr; `sql/migrate_3.3.0_to_4.0.0.sql`
   - Da 3.3.0: `sql/migrate_3.3.0_to_4.0.0.sql`
3. Distribuisci i nuovi file.
4. Non eliminare subito la tabella `easylogger_user_timers`: i timer memorizzati nel vecchio formato JSON vengono migrati automaticamente al primo accesso di ciascun utente. Quando tutti gli utenti hanno effettuato l'accesso è possibile rimuoverla.

---

## 🔑 Recupero Password

EasyLogger non richiede un server SMTP per l'invio di email. Quando un utente richiede il reset viene creato un token monouso (valido 24 ore).

L'amministratore del sistema può recuperare i token attivi con la seguente query:
```sql
SELECT u.username, r.token, r.expires_at
FROM easylogger_password_resets r
JOIN easylogger_users u ON u.id = r.user_id
WHERE r.used = 0 AND r.expires_at > NOW()
ORDER BY r.id DESC;
```
E inviare all'utente il link:
```
https://tuo-dominio.com/reset.php?token=<token>
```

---

## 🌍 Aggiungere una lingua

1. Aggiungi il blocco dizionario in `public/assets/js/i18n.js` con le stesse chiavi di `it` / `en`.
2. Aggiungi il codice lingua alla funzione `validLang()` in `public/api.php`.

---

## 🤝 Contribuire

I contributi sono benvenuti! Consulta il file [CONTRIBUTING.md](CONTRIBUTING.md) per le indicazioni sulla segnalazione di bug e sulle pull request.

---

## 📄 Licenza

Questo progetto è rilasciato sotto licenza open source **GNU General Public License v3.0 (GPLv3)**.  
Consulta il file [LICENSE](LICENSE) per i termini completi.
