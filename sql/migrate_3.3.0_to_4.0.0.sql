-- ==========================================================
--  EasyLogger — Migrazione 3.3.0 → 4.0.0
--  1) FAI UN BACKUP del database.
--  2) Eseguilo UNA SOLA VOLTA, dopo gli script precedenti.
--
--  • Attività: uid (idempotenza), version, rev, updated_at, deleted_at
--  • Timer: nuova tabella easylogger_timers (un record per timer).
--    I timer salvati nel vecchio formato (easylogger_user_timers) vengono
--    convertiti automaticamente al primo accesso di ogni utente: NON
--    eliminare easylogger_user_timers finché tutti gli utenti non si sono
--    collegati almeno una volta con la 4.0.
-- ==========================================================

SET NAMES utf8mb4;

ALTER TABLE `easylogger_users`
  ADD `rev`             BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `lang`,
  ADD `labels_rev`      BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `rev`,
  ADD `purged_rev`      BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER `labels_rev`,
  ADD `timers_migrated` TINYINT(1)      NOT NULL DEFAULT 0 AFTER `purged_rev`;

ALTER TABLE `easylogger_activities`
  ADD `uid`        VARCHAR(64)     NULL AFTER `user_id`,
  ADD `version`    INT UNSIGNED    NOT NULL DEFAULT 1,
  ADD `rev`        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  ADD `updated_at` DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  ADD `deleted_at` DATETIME        NULL DEFAULT NULL,
  MODIFY `timer_id` VARCHAR(64)    NOT NULL DEFAULT '';

-- uid per le attività esistenti (UUID() è calcolato per ogni riga)
UPDATE `easylogger_activities` SET `uid` = UUID() WHERE `uid` IS NULL;

ALTER TABLE `easylogger_activities`
  MODIFY `uid` VARCHAR(64) NOT NULL,
  ADD UNIQUE KEY `uq_user_uid` (`user_id`, `uid`),
  ADD KEY `idx_user_rev` (`user_id`, `rev`);

CREATE TABLE IF NOT EXISTS `easylogger_timers` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED    NOT NULL,
  `uid`           VARCHAR(64)     NOT NULL,
  `position`      INT UNSIGNED    NOT NULL DEFAULT 0,
  `state`         VARCHAR(10)     NOT NULL DEFAULT 'idle',
  `session_start` BIGINT          NULL DEFAULT NULL,
  `accumulated_s` INT UNSIGNED    NOT NULL DEFAULT 0,
  `live_sessions` JSON            NOT NULL,
  `description`   TEXT            NOT NULL,
  `category`      VARCHAR(40)     NOT NULL DEFAULT 'altro',
  `version`       INT UNSIGNED    NOT NULL DEFAULT 1,
  `rev`           BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `updated_at`    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`    DATETIME        NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_uid` (`user_id`, `uid`),
  KEY `idx_user_rev` (`user_id`, `rev`),
  CONSTRAINT `fk_el_timers_user` FOREIGN KEY (`user_id`)
    REFERENCES `easylogger_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
