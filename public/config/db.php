<?php
require_once __DIR__ . '/app.php';

function getDB(): PDO {
  static $db = null;
  if ($db !== null) return $db;

  $cfgFile = __DIR__ . '/config.local.php';
  $cfg = is_file($cfgFile) ? (require $cfgFile) : [];

  $host = getenv('DB_HOST') ?: ($cfg['db_host'] ?? 'localhost');
  $name = getenv('DB_NAME') ?: ($cfg['db_name'] ?? '');
  $user = getenv('DB_USER') ?: ($cfg['db_user'] ?? '');
  $pass = getenv('DB_PASS') ?: ($cfg['db_pass'] ?? '');

  $db = new PDO(
    "mysql:host=$host;dbname=$name;charset=utf8mb4",
    $user,
    $pass,
    [
      PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES   => false,
    ]
  );
  return $db;
}
