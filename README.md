# EasyLogger

[![Version](https://img.shields.io/badge/version-4.0.0-blue.svg)](CHANGELOG.md)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![PHP](https://img.shields.io/badge/PHP-8.0%2B-777bb4.svg)](https://www.php.net/)
[![Database](https://img.shields.io/badge/Database-MySQL%20%7C%20MariaDB-orange.svg)](https://mariadb.org/)
[![PWA](https://img.shields.io/badge/PWA-offline--first-green.svg)](public/manifest.json)

> **EasyLogger** is a lightweight, local-first multi-timer time tracking web application and Progressive Web App (PWA).  
> Built with HTML5, vanilla JavaScript, PHP 8+, and MySQL/MariaDB. Created by [sputlab.com](https://www.sputlab.com).

[🇮🇹 **Leggi la documentazione in italiano**](README.it.md)

---

## ✨ Features

- ⏱️ **Multi-Timer Time Tracking** — Create, pause, and run multiple timers simultaneously.
- 📴 **Local-First & Offline Ready (PWA)** — Powered by a dedicated Service Worker (`sw.php`). All actions (timers, activities, labels) save instantly to local storage and queue up seamlessly when offline.
- 🔄 **Reliable Delta Synchronization**:
  - **Idempotent requests** using client-generated `uid` identifiers (network drops won't create duplicates).
  - **Incremental sync** (`sync?since=N`) downloads only changed records using a monotonic per-user revision counter.
  - **Soft deletes** (*tombstones*) kept for 90 days.
  - **Optimistic concurrency control** via record `version` numbers to detect and resolve multi-device conflicts.
  - Automatic background synchronization on changes, every 30 seconds when active, on window focus, and on network reconnect.
- 🏷️ **Custom Labels & Categories** — Categorize activities with custom colors and labels.
- 📊 **Activity History & PDF Export** — Filter logs and export formatted PDF activity reports directly from the browser (via jsPDF).
- 🌐 **Multilingual (i18n)** — Native Italian and English support; automatically detects browser locale and allows manual switching.
- 🌓 **Dark & Light Mode** — Responsive interface with automatic system preference detection and instant toggle.
- 🔒 **Security Hardened**:
  - Secure PHP session cookies (`SameSite=Strict`, `HttpOnly`, `Secure`).
  - Strict security headers (CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
  - IP-based rate limiting on sensitive endpoints (login, registration, password reset).
  - CSRF protection on state-modifying actions.
  - Separation of web root (`public/`) from application core and database migration scripts.

---

## 📁 Repository Structure

```
.
├── .github/                 # GitHub issue templates and CI workflows
├── public/                  # Web server DocumentRoot (exposed to the web)
│   ├── assets/
│   │   ├── css/style.css    # Responsive styles (light & dark theme)
│   │   └── js/
│   │       ├── app.js       # Core application logic & sync engine
│   │       └── i18n.js      # Translations (Italian & English)
│   ├── config/
│   │   ├── app.php          # App constants, table prefix, account rules
│   │   ├── config.local.php # Local DB credentials (NOT versioned)
│   │   ├── config.sample.php# Configuration template
│   │   └── db.php           # PDO connection handler (supports env vars)
│   ├── favicon/             # Standard favicons
│   ├── icons/               # PWA app icons for various resolutions
│   ├── inc/
│   │   └── sync.php         # Server-side sync engine (push & delta sync)
│   ├── logs/                # Protected error log directory (errors.log)
│   ├── api.php              # JSON REST API endpoint
│   ├── index.php            # Main single-page web app entrypoint
│   ├── manifest.json        # PWA Web App Manifest
│   ├── reset.php            # Password reset page
│   └── sw.php               # Dynamic Service Worker with automatic cache-busting
├── resources/               # Design assets (vector SVG master icons)
├── sql/
│   ├── install.sql          # Clean database schema installation
│   ├── migrate_3.1.0_to_3.2.0.sql
│   ├── migrate_3.2.x_to_3.3.0.sql
│   └── migrate_3.3.0_to_4.0.0.sql
├── CHANGELOG.md             # Semantic versioning history
├── CONTRIBUTING.md          # Contribution guidelines
├── LICENSE                  # GNU General Public License v3
├── README.md                # English documentation
└── README.it.md             # Italian documentation
```

---

## 🚀 Requirements

- **PHP**: `>= 8.0` with `pdo_mysql`, `json`, and `session` extensions enabled.
- **Database**: **MySQL** `>= 5.7` or **MariaDB** `>= 10.3` (with InnoDB and `utf8mb4` support).
- **Web Server**: **Apache** (`mod_rewrite`, `mod_headers`, `mod_expires` enabled) or **Nginx**.
- **HTTPS**: Required for Service Worker / PWA offline functionality (except on `localhost`).

---

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone https://github.com/your-username/EasyLogger.git
cd EasyLogger
```

### 2. Set up the Database
Import the installation schema into your MySQL/MariaDB database:
```bash
mysql -u your_user -p your_database < sql/install.sql
```

### 3. Configure Database Credentials
Copy `public/config/config.sample.php` to `public/config/config.local.php`:
```bash
cp public/config/config.sample.php public/config/config.local.php
```
Edit `public/config/config.local.php` with your database credentials:
```php
<?php
return [
  'db_host' => '127.0.0.1',
  'db_name' => 'your_database',
  'db_user' => 'your_user',
  'db_pass' => 'your_password',
];
```

> [!TIP]
> **Environment Variables**: Alternatively, configure your environment using `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASS`. Environment variables automatically override values in `config.local.php`.

### 4. Configure Web Server

#### Option A: Point DocumentRoot to `public/` (Recommended)
Configure your virtual host to serve from the `public/` subfolder:

**Apache VirtualHost example:**
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

**Nginx server block example:**
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

    # Deny access to sensitive files and hidden files
    location ~* (^#.*#|\.(bak|config|dist|fla|inc|ini|log|psd|sh|sql|sw[op]|sample)|~)$ {
        deny all;
    }
    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

#### Option B: Deploy in a subdirectory or with root DocumentRoot
If your web server points to the project root or a subfolder (e.g. `https://example.com/easylogger/`), the included root `.htaccess` will automatically rewrite requests to `public/`.

---

## 🐳 Quick Start with Docker

You can test and run EasyLogger instantly using Docker Compose:

```bash
docker compose up -d
```
Then visit `http://localhost:8080`.

---

## 🔄 Upgrading to 4.0.0

1. **Backup your database.**
2. Run pending migration scripts in order:
   - Upgrading from 3.1.x: `sql/migrate_3.1.0_to_3.2.0.sql` &rarr; `sql/migrate_3.2.x_to_3.3.0.sql` &rarr; `sql/migrate_3.3.0_to_4.0.0.sql`
   - Upgrading from 3.2.x: `sql/migrate_3.2.x_to_3.3.0.sql` &rarr; `sql/migrate_3.3.0_to_4.0.0.sql`
   - Upgrading from 3.3.0: `sql/migrate_3.3.0_to_4.0.0.sql`
3. Deploy the new files.
4. Existing user timers stored in the legacy JSON format are automatically migrated on each user's first login.

---

## 🔑 Password Reset

EasyLogger does not require an SMTP mail server. When a user requests a password reset, a secure 24-hour token is generated.

The system administrator can retrieve active tokens from the database:
```sql
SELECT u.username, r.token, r.expires_at
FROM easylogger_password_resets r
JOIN easylogger_users u ON u.id = r.user_id
WHERE r.used = 0 AND r.expires_at > NOW()
ORDER BY r.id DESC;
```
Send the reset link to the user:
```
https://your-domain.com/reset.php?token=<token>
```

---

## 🌍 Adding a Language

1. Add your language dictionary block to `public/assets/js/i18n.js` matching the existing keys in `it` / `en`.
2. Add the language code to the `validLang()` validation helper in `public/api.php`.

---

## 🤝 Contributing

Contributions are welcome! Please check out [CONTRIBUTING.md](CONTRIBUTING.md) for details on submitting issues and pull requests.

---

## 📄 License

This project is open-source software licensed under the **GNU General Public License v3.0 (GPLv3)**.  
See the [LICENSE](LICENSE) file for the full license text.
