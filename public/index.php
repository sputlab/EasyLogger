<?php
require_once __DIR__ . '/config/app.php';
$v = htmlspecialchars(APP_VERSION, ENT_QUOTES, 'UTF-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: DENY');
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EasyLogger v<?= $v ?> by sputlab.com</title>
  <meta name="description" content="EasyLogger — time tracker multi-timer / multi-timer time tracker">

  <!-- Tema e lingua applicati prima del rendering (evita il "flash") -->
  <script>
    (function () {
      try {
        var d = localStorage.getItem('darkMode');
        var dark = d === null ? window.matchMedia('(prefers-color-scheme: dark)').matches : d === 'true';
        if (dark) document.documentElement.classList.add('dark');
        var l = localStorage.getItem('el_lang') || (navigator.language || 'it').slice(0, 2).toLowerCase();
        document.documentElement.lang = (l === 'en') ? 'en' : 'it';
      } catch (e) {}
    })();
    window.APP_VERSION = '<?= $v ?>';
  </script>

  <!-- Favicon -->
  <link rel="icon" type="image/svg+xml" href="icons/easylogger-icon.svg">
  <link rel="icon" type="image/x-icon" href="favicon/favicon.ico">
  <link rel="icon" type="image/png" sizes="16x16" href="favicon/favicon-16x16.png">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="48x48" href="favicon/favicon-48x48.png">
  <link rel="icon" type="image/png" sizes="96x96" href="favicon/favicon-96x96.png">
  <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192x192.png">
  <link rel="icon" type="image/png" sizes="512x512" href="icons/icon-512x512.png">

  <!-- PWA -->
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#d4500a">

  <!-- iOS -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="EasyLogger">
  <link rel="apple-touch-icon" sizes="180x180" href="icons/icon-180x180.png">
  <link rel="apple-touch-icon" sizes="152x152" href="icons/icon-152x152.png">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css?v=<?= $v ?>">
</head>
<body>

<!-- ═══════════════════ TOPBAR ═══════════════════ -->
<header class="topbar">
  <button type="button" class="topbar-logo" onclick="nav('home')">
    <img src="icons/easylogger-icon.svg" class="topbar-icon" alt="" width="28" height="28">
    <span>Easy<span>Logger</span></span>
  </button>
  <div class="topbar-right">
    <span class="sync-badge" id="syncBadge" style="display:none" role="status" aria-live="polite"></span>
    <button type="button" class="user-pill" id="userPill" onclick="nav('account')" style="display:none"></button>
    <button type="button" class="burger" id="burgerBtn" onclick="toggleDrawer()" aria-expanded="false" aria-controls="drawer" data-i18n-aria="menu.open">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>

<!-- ═══════════════════ DRAWER ═══════════════════ -->
<div class="drawer-overlay" id="drawerOverlay" onclick="closeDrawer()"></div>
<nav class="drawer" id="drawer">
  <div class="drawer-head">
    <div class="drawer-brand">
      <img src="icons/easylogger-icon.svg" class="drawer-icon" alt="" width="24" height="24">
      <span class="ttl">Easy<span>Logger</span></span>
    </div>
    <button type="button" class="drawer-close" onclick="closeDrawer()" data-i18n-aria="menu.close">×</button>
  </div>
  <div class="drawer-body">
    <button type="button" class="drawer-item" onclick="toggleTheme();closeDrawer()">
      <span class="di-icon" id="themeIcon">🌙</span> <span data-i18n="menu.theme">Tema scuro/chiaro</span>
    </button>
    <button type="button" class="drawer-item" onclick="toggleLanguage();closeDrawer()">
      <span class="di-icon" data-i18n="lang.switchIcon">🇬🇧</span> <span data-i18n="lang.switch">English</span>
    </button>
    <button type="button" class="drawer-item" id="drawerSyncBtn" onclick="closeDrawer();forceSync()">
      <span class="di-icon">🔄</span> <span data-i18n="menu.sync">Ricarica e sincronizza</span>
    </button>
    <div class="drawer-sep"></div>
    <button type="button" class="drawer-item" id="drawerLoginBtn" onclick="nav('auth');closeDrawer()">
      <span class="di-icon">👤</span> <span data-i18n="menu.login">Accedi / Registrati</span>
    </button>
    <button type="button" class="drawer-item" id="drawerAccountBtn" onclick="nav('account');closeDrawer()" style="display:none">
      <span class="di-icon">👤</span> <span data-i18n="menu.account">Il mio account</span>
    </button>
    <button type="button" class="drawer-item" id="drawerLogoutBtn" onclick="closeDrawer();doLogout()" style="display:none">
      <span class="di-icon">🚪</span> <span data-i18n="menu.logout">Esci</span>
    </button>
    <div class="drawer-sep"></div>
    <button type="button" class="drawer-item" onclick="nav('about');closeDrawer()">
      <span class="di-icon">ℹ️</span> <span data-i18n="menu.about">Informazioni su EasyLogger</span>
    </button>
  </div>
  <div class="drawer-foot">
    <div class="drawer-version" data-version="short"><img src="icons/easylogger-icon.svg" class="drawer-foot-icon" alt="" width="14" height="14"> EasyLogger v<?= $v ?> by sputlab.com</div>
  </div>
</nav>

<main>
<!-- ═══════════════════ PAGE: AUTH ═══════════════ -->
<section class="page" id="page-auth">
  <div class="auth-wrap">
    <div class="auth-box">
      <div class="auth-brand">
        <img src="icons/easylogger-icon.svg" class="auth-icon" alt="EasyLogger" width="56" height="56">
        <div class="about-logo">Easy<span>Logger</span></div>
      </div>
      <h2 id="authTitle">Accedi</h2>
      <p class="sub" id="authSub">Bentornato su EasyLogger</p>
      <div class="auth-form">
        <div class="field">
          <label for="authUser" data-i18n="auth.username">Username</label>
          <input type="text" id="authUser" data-i18n-placeholder="auth.usernamePh" autocomplete="username" maxlength="30" autocapitalize="none" spellcheck="false">
        </div>
        <div class="field">
          <label for="authPass" data-i18n="auth.password">Password</label>
          <input type="password" id="authPass" placeholder="••••••••" autocomplete="current-password">
        </div>
        <div class="err-msg" id="authErr" role="alert"></div>
        <button type="button" class="btn btn-accent btn-full mt8" id="authSubmit" onclick="submitAuth()">Accedi</button>
        <div class="center mt12">
          <button type="button" class="link-btn" onclick="nav('reset')" data-i18n="auth.forgot">Password dimenticata?</button>
        </div>
      </div>
      <div class="auth-switch">
        <span id="authSwitchText">Non hai un account?</span>
        <button type="button" id="authSwitchBtn" onclick="toggleAuthMode()">Registrati</button>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════ PAGE: HOME ═══════════════ -->
<section class="page active" id="page-home">
  <div class="page-inner">

    <div class="guest-hint" id="guestHint" style="display:none">
      <span data-i18n="home.guestHint"></span>
      <button type="button" class="link-btn" onclick="nav('auth')" data-i18n="home.guestHintBtn"></button>
    </div>

    <!-- Timer stack -->
    <div id="timerStack"></div>
    <button type="button" class="add-timer-btn" id="addTimerBtn" onclick="addTimer()" data-i18n="home.newTimer">＋ Nuovo timer</button>

    <!-- Grand total -->
    <div class="total-bar">
      <span class="lbl" data-i18n="home.total">Durata totale</span>
      <span class="val" id="grandTotal">00:00:00</span>
    </div>

    <!-- Export / Reset -->
    <div class="btn-row2">
      <button type="button" class="btn btn-ghost" onclick="confirmResetAll()" data-i18n="home.resetList">🗑 Reset lista</button>
      <button type="button" class="btn btn-accent" onclick="exportPDF()" data-i18n="home.exportPdf">↓ Esporta PDF</button>
    </div>

    <!-- Saved activities -->
    <div>
      <div class="section-hd">
        <span class="ttl" data-i18n="home.activities">Attività registrate</span>
        <span class="badge" id="actCount">0</span>
      </div>
      <div class="act-list" id="actList"></div>
    </div>

  </div>
</section>

<!-- ═══════════════════ PAGE: ACCOUNT ════════════ -->
<section class="page" id="page-account">
  <div class="page-inner">
    <div class="page-head">
      <button type="button" class="btn btn-ghost btn-back" onclick="nav('home')" data-i18n="account.back">← Indietro</button>
      <h2 data-i18n="account.title">Il mio account</h2>
    </div>

    <!-- Stats -->
    <div class="card">
      <div class="card-title" data-i18n="account.stats">📊 Statistiche</div>
      <div class="stat-grid">
        <div class="stat-box"><div class="sv" id="statActs">—</div><div class="sl" data-i18n="account.totalActs">Attività totali</div></div>
        <div class="stat-box"><div class="sv" id="statTime">—</div><div class="sl" data-i18n="account.hours">Ore registrate</div></div>
      </div>
      <div id="statCats"></div>
      <div class="mt12"><div class="small-mono" id="statMember"></div></div>
      <button type="button" class="btn btn-ghost btn-full mt16" onclick="confirmResetStats()" style="font-size:12px;" data-i18n="account.resetStats">🔄 Azzera statistiche</button>
    </div>

    <!-- Labels management -->
    <div class="card">
      <div class="card-title" data-i18n="account.labels">🏷️ Etichette personalizzate</div>
      <p class="muted-note" data-i18n="account.labelsHint"></p>
      <div class="label-list" id="labelList"></div>
      <button type="button" class="label-add-btn" onclick="addLabel()" data-i18n="account.addLabel">＋ Aggiungi etichetta</button>
    </div>

    <!-- Change username -->
    <div class="card">
      <div class="card-title" data-i18n="account.changeUsername">✏️ Cambia username</div>
      <div class="field">
        <label for="newUsername" data-i18n="account.newUsername">Nuovo username</label>
        <input type="text" id="newUsername" data-i18n-placeholder="account.newUsernamePh" maxlength="30" autocomplete="username" autocapitalize="none" spellcheck="false">
      </div>
      <div class="err-msg" id="unErr" role="alert"></div>
      <div class="success-msg" id="unOk" data-i18n="account.usernameOk">Username aggiornato!</div>
      <button type="button" class="btn btn-accent btn-full mt12" onclick="updateUsername()" data-i18n="account.saveUsername">Salva username</button>
    </div>

    <!-- Change password -->
    <div class="card">
      <div class="card-title" data-i18n="account.changePassword">🔑 Cambia password</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div class="field"><label for="oldPass" data-i18n="account.currentPassword">Password attuale</label><input type="password" id="oldPass" placeholder="••••••••" autocomplete="current-password"></div>
        <div class="field"><label for="newPass" data-i18n="account.newPassword">Nuova password</label><input type="password" id="newPass" placeholder="••••••••" autocomplete="new-password"></div>
      </div>
      <div class="err-msg" id="pwErr" role="alert"></div>
      <div class="success-msg" id="pwOk" data-i18n="account.passwordOk">Password aggiornata!</div>
      <button type="button" class="btn btn-accent btn-full mt12" onclick="updatePassword()" data-i18n="account.savePassword">Cambia password</button>
    </div>

    <!-- Danger zone -->
    <div class="card card-danger">
      <div class="card-title" data-i18n="account.danger">⚠️ Zona pericolosa</div>
      <p class="muted-note" data-i18n="account.dangerText"></p>
      <div class="field"><label for="delPass" data-i18n="account.confirmWithPassword">Conferma con la tua password</label><input type="password" id="delPass" placeholder="••••••••" autocomplete="current-password"></div>
      <div class="err-msg" id="delErr" role="alert"></div>
      <button type="button" class="btn btn-red btn-full mt12" onclick="deleteAccount()" data-i18n="account.deleteAccount">Elimina il mio account</button>
    </div>
  </div>
</section>

<!-- ═══════════════════ PAGE: ABOUT ══════════════ -->
<section class="page" id="page-about">
  <div class="page-inner">
    <button type="button" class="btn btn-ghost btn-back" onclick="nav('home')" style="align-self:flex-start;" data-i18n="account.back">← Indietro</button>
    <div class="card">
      <div class="about-brand">
        <img src="icons/easylogger-icon.svg" class="about-icon" alt="EasyLogger" width="64" height="64">
        <div class="about-logo">Easy<span>Logger</span></div>
      </div>
      <div class="about-ver" data-version="about">versione <?= $v ?> · by sputlab.com</div>
      <p class="about-p" data-i18n="about.p1"></p>
      <p class="about-p" data-i18n="about.p2"></p>
      <ul class="feature-list mt12">
        <li><span class="fi">⏱</span> <span data-i18n="about.f1"></span></li>
        <li><span class="fi">📋</span> <span data-i18n="about.f2"></span></li>
        <li><span class="fi">💾</span> <span data-i18n="about.f3"></span></li>
        <li><span class="fi">📄</span> <span data-i18n="about.f4"></span></li>
        <li><span class="fi">🌙</span> <span data-i18n="about.f5"></span></li>
        <li><span class="fi">🌐</span> <span data-i18n="about.f6"></span></li>
        <li><span class="fi">📱</span> <span data-i18n="about.f7"></span></li>
      </ul>
      <div class="about-support">
        <p>❤️ <strong data-i18n="about.support">Supporta lo sviluppo di EasyLogger</strong></p>
        <a href="https://www.sputlab.com/donate" target="_blank" rel="noopener" class="btn btn-accent donate-btn mt12" data-i18n="about.donate">❤️ Fai una donazione</a>
      </div>
    </div>
  </div>
</section>

<!-- ═══════════════════ PAGE: RESET PASSWORD ══════════════ -->
<section class="page" id="page-reset">
  <div class="auth-wrap">
    <div class="auth-box">
      <div class="auth-brand">
        <img src="icons/easylogger-icon.svg" class="auth-icon" alt="EasyLogger" width="56" height="56">
        <div class="about-logo">Easy<span>Logger</span></div>
      </div>
      <h2 data-i18n="reset.title">Recupera password</h2>
      <p class="sub" data-i18n="reset.sub">Inserisci il tuo username</p>
      <div class="field">
        <label for="resetUser" data-i18n="auth.username">Username</label>
        <input type="text" id="resetUser" autocomplete="username" autocapitalize="none" spellcheck="false">
      </div>
      <div class="err-msg" id="resetErr" role="alert"></div>
      <div class="success-msg" id="resetOk" data-i18n="reset.ok"></div>
      <button type="button" class="btn btn-accent btn-full mt12" onclick="requestReset()" data-i18n="reset.submit">Invia richiesta</button>
      <div class="center mt12">
        <button type="button" onclick="nav('auth')" class="btn btn-ghost" data-i18n="reset.back">← Torna al login</button>
      </div>
    </div>
  </div>
</section>
</main>

<div class="toast" id="toast" role="status" aria-live="polite"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" defer></script>
<script src="assets/js/i18n.js?v=<?= $v ?>"></script>
<script src="assets/js/app.js?v=<?= $v ?>"></script>
</body>
</html>
