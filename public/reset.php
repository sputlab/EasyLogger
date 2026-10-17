<?php
require_once __DIR__ . '/config/app.php';
$v = htmlspecialchars(APP_VERSION, ENT_QUOTES, 'UTF-8');
$token = preg_replace('/[^a-f0-9]/', '', (string)($_GET['token'] ?? ''));
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');   // il token non deve finire nei referrer
header('X-Frame-Options: DENY');
?>
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
  <title>EasyLogger — Reset password</title>
  <link rel="icon" type="image/svg+xml" href="icons/easylogger-icon.svg">
  <link rel="icon" type="image/x-icon" href="favicon/favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="favicon/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="favicon/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="icons/icon-180x180.png">
  <script>
    (function () {
      try {
        var d = localStorage.getItem('darkMode');
        var dark = d === null ? window.matchMedia('(prefers-color-scheme: dark)').matches : d === 'true';
        if (dark) document.documentElement.classList.add('dark');
      } catch (e) {}
    })();
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css?v=<?= $v ?>">
</head>
<body>
  <div class="auth-wrap" style="min-height:100vh">
    <div class="auth-box">
      <div class="auth-brand">
        <img src="icons/easylogger-icon.svg" class="auth-icon" alt="EasyLogger" width="56" height="56">
        <div class="about-logo">Easy<span>Logger</span></div>
      </div>
      <h2 data-i18n="reset.page.title">Reimposta la password</h2>
      <div class="auth-form mt16" id="resetForm">
        <div class="field">
          <label for="pw" data-i18n="reset.page.new">Nuova password</label>
          <input type="password" id="pw" autocomplete="new-password">
        </div>
        <div class="field">
          <label for="pw2" data-i18n="reset.page.confirm">Conferma password</label>
          <input type="password" id="pw2" autocomplete="new-password">
        </div>
        <div class="err-msg" id="err" role="alert"></div>
        <button type="button" class="btn btn-accent btn-full mt8" id="go" data-i18n="reset.page.submit">Conferma</button>
      </div>
      <div class="success-msg" id="ok" data-i18n="reset.page.done"></div>
      <div class="center mt16">
        <a href="./" class="btn btn-ghost" data-i18n="reset.page.goApp">Vai a EasyLogger</a>
      </div>
    </div>
  </div>

<script src="assets/js/i18n.js?v=<?= $v ?>"></script>
<script>
(function () {
  var TOKEN = <?= json_encode($token) ?>;
  var err = document.getElementById('err');
  applyI18n();

  function showErr(msg) { err.textContent = msg; err.classList.add('show'); }

  if (!TOKEN) {
    document.getElementById('resetForm').style.display = 'none';
    showErr(t('reset.page.noToken'));
    document.querySelector('.auth-box h2').after(err);
    return;
  }

  async function go() {
    err.classList.remove('show');
    var pw = document.getElementById('pw').value, pw2 = document.getElementById('pw2').value;
    if (pw.length < PASSWORD_MIN) return showErr(t('common.passwordMin', { n: PASSWORD_MIN }));
    if (pw !== pw2) return showErr(t('reset.page.mismatch'));
    var btn = document.getElementById('go');
    btn.disabled = true;
    try {
      var chk = await (await fetch('api.php?action=check', { credentials: 'same-origin' })).json();
      var r = await fetch('api.php?action=reset_password', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: TOKEN, password: pw, csrf: chk.data && chk.data.csrf })
      });
      var j = await r.json();
      if (j.ok) {
        document.getElementById('resetForm').style.display = 'none';
        document.getElementById('ok').classList.add('show');
      } else {
        showErr(tErr(j.error || 'server_error'));
      }
    } catch (e) {
      showErr(tErr('network'));
    } finally {
      btn.disabled = false;
    }
  }
  document.getElementById('go').addEventListener('click', go);
  document.getElementById('pw2').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
})();
</script>
</body>
</html>
