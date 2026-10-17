# Contributing to EasyLogger

Thank you for your interest in contributing to **EasyLogger**! Whether you want to fix a bug, suggest an improvement, or translate the app into a new language, your help is appreciated.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Features](#suggesting-features)
  - [Adding Translations (i18n)](#adding-translations-i18n)
  - [Submitting Pull Requests](#submitting-pull-requests)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [License](#license)

---

## Code of Conduct

Please be respectful, constructive, and helpful when interacting with other contributors and users. Harassment, discriminatory language, or unprofessional conduct will not be tolerated.

---

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please search existing GitHub Issues to see if the issue has already been reported.

When filing a bug report, please provide:
1. **Description**: Clear description of the bug.
2. **Steps to Reproduce**: Step-by-step instructions to trigger the problem.
3. **Expected vs Actual Behavior**: What should happen vs what actually happened.
4. **Environment**: Browser name and version, OS, PHP version, MySQL/MariaDB version.
5. **Logs / Errors**: Relevant browser console logs or entries from `public/logs/errors.log` (be sure to redact any sensitive credentials).

### Suggesting Features

Feature requests are welcome! Open an issue describing:
- The problem you want solved or the use case.
- The proposed solution or workflow.
- Any alternative solutions considered.

### Adding Translations (i18n)

EasyLogger supports multiple languages:
1. Open `public/assets/js/i18n.js`.
2. Duplicate the English dictionary block (`en: { ... }`) and provide translations for your target language code (e.g. `es`, `de`, `fr`).
3. Add the two-letter language code to `validLang()` in `public/api.php`.
4. Test that the language selector switches strings correctly.
5. Open a pull request!

### Submitting Pull Requests

1. **Fork** the repository and clone your fork locally.
2. Create a new branch with a descriptive name:
   ```bash
   git checkout -b feature/my-new-feature
   # or
   git checkout -b fix/issue-description
   ```
3. Make your changes adhering to project coding standards.
4. Verify syntax and test functionality:
   ```bash
   # Check PHP syntax
   find public -name "*.php" -exec php -l {} \;
   ```
5. Commit your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "fix(sync): resolve edge case in optimistic lock conflict handling"
   ```
6. Push to your fork and submit a **Pull Request** against the `main` branch.

---

## Development Setup

1. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/EasyLogger.git
   cd EasyLogger
   ```
2. **Database**:
   Import `sql/install.sql` into a local MySQL or MariaDB database.
3. **Configuration**:
   Copy `public/config/config.sample.php` to `public/config/config.local.php` and set your local credentials.
   *(Note: `config.local.php` is ignored by `.gitignore` and must never be committed).*
4. **Run with PHP Built-in Server**:
   ```bash
   php -S 127.0.0.1:8000 -t public
   ```
   Open `http://127.0.0.1:8000` in your browser.

   > *Note: Service Workers require HTTPS except on `localhost` or `127.0.0.1`.*

---

## Coding Standards

- **PHP**: PHP 8.0+ compatibility, `declare(strict_types=1);` in backend files, prepared statements for all database operations, clear docstrings and comments.
- **JavaScript**: Modern vanilla JavaScript (ES6+), no heavy build tools or unnecessary dependencies.
- **CSS**: Pure CSS variables (`--bg`, `--accent`, etc.) supporting both Light and Dark modes.
- **Clean Diff**: Do not commit OS-specific files (`.DS_Store`), editor folders (`.idea/`, `.vscode/`), or credentials.

---

## License

By contributing to EasyLogger, you agree that your contributions will be licensed under the **GNU General Public License v3.0 (GPLv3)**.
