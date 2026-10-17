-- ==========================================================
--  EasyLogger — Migrazione 3.1.0 → 3.2.0
--  1) FAI UN BACKUP del database prima di eseguire lo script.
--  2) Eseguilo UNA SOLA VOLTA (phpMyAdmin → SQL, oppure CLI).
--  Rinomina le tabelle con il prefisso easylogger_ e allinea
--  lo schema a quello usato dal codice.
-- ==========================================================

SET NAMES utf8mb4;

-- 1. Prefisso easylogger_ su tutte le tabelle (i vincoli FK seguono il rename)
RENAME TABLE
  `users`           TO `easylogger_users`,
  `activities`      TO `easylogger_activities`,
  `password_resets` TO `easylogger_password_resets`,
  `user_labels`     TO `easylogger_user_labels`,
  `user_timers`     TO `easylogger_user_timers`;

-- 2. Utenti: last_logout_at diventa list_cleared_at (usato anche da "Reset lista")
--    + lingua preferita
ALTER TABLE `easylogger_users`
  CHANGE `last_logout_at` `list_cleared_at` DATETIME NULL DEFAULT NULL,
  ADD `lang` VARCHAR(5) NOT NULL DEFAULT 'it' AFTER `password`;

-- 3. Attività: timer_id fino a 64 caratteri (risolve "Data too long for column 'timer_id'")
ALTER TABLE `easylogger_activities`
  MODIFY `timer_id` VARCHAR(64) NOT NULL,
  ADD KEY `idx_user_created` (`user_id`, `created_at`);

-- 3b. Attività vecchie senza testo etichetta (evita "null" nelle statistiche)
UPDATE `easylogger_activities` SET `category_text` = `category` WHERE `category_text` IS NULL OR `category_text` = '';

-- 4. Nuova tabella per il rate limiting per IP
CREATE TABLE IF NOT EXISTS `easylogger_rate_limits` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `bucket`     VARCHAR(20)     NOT NULL,
  `ip`         VARCHAR(45)     NOT NULL,
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bucket_ip_time` (`bucket`, `ip`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Invalida i vecchi token di reset (in 3.1 non venivano mai consegnati)
UPDATE `easylogger_password_resets` SET `used` = 1 WHERE `used` = 0;
