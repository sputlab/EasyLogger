-- ==========================================================
--  EasyLogger 4.0.0 — Schema DB (installazione pulita)
--  EasyLogger 4.0.0 — DB schema (fresh install)
--  Tutte le tabelle usano il prefisso easylogger_
--  Per aggiornare un'installazione esistente usa gli script migrate_*.sql in ordine.
-- ==========================================================

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `easylogger_users` (
  `id`              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `username`        VARCHAR(60)     NOT NULL,
  `password`        VARCHAR(255)    NOT NULL,               -- hash password_hash()
  `lang`            VARCHAR(5)      NOT NULL DEFAULT 'it',  -- lingua preferita (it|en)
  `rev`             BIGINT UNSIGNED NOT NULL DEFAULT 0,     -- revisione di sincronizzazione
  `labels_rev`      BIGINT UNSIGNED NOT NULL DEFAULT 0,     -- revisione dell'ultima modifica etichette
  `purged_rev`      BIGINT UNSIGNED NOT NULL DEFAULT 0,     -- revisione dell'ultima pulizia dei tombstone
  `timers_migrated` TINYINT(1)      NOT NULL DEFAULT 1,     -- 1 = niente da migrare dal formato 3.x
  `list_cleared_at` DATETIME        NULL DEFAULT NULL,      -- "Reset lista"
  `stats_reset_at`  DATETIME        NULL DEFAULT NULL,      -- "Azzera statistiche"
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `easylogger_activities` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED    NOT NULL,
  `uid`           VARCHAR(64)     NOT NULL,                 -- id generato dal client (idempotenza)
  `timer_id`      VARCHAR(64)     NOT NULL DEFAULT '',
  `description`   TEXT            NOT NULL,
  `category`      VARCHAR(40)     NOT NULL DEFAULT 'altro',
  `category_text` VARCHAR(60)     NOT NULL DEFAULT '',
  `total_seconds` INT UNSIGNED    NOT NULL DEFAULT 0,
  `sessions`      JSON            NOT NULL,                 -- [{start,end,seconds}]
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `version`       INT UNSIGNED    NOT NULL DEFAULT 1,       -- controllo di concorrenza
  `rev`           BIGINT UNSIGNED NOT NULL DEFAULT 0,       -- revisione dell'ultima modifica
  `updated_at`    DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `deleted_at`    DATETIME        NULL DEFAULT NULL,        -- cancellazione "soft" (tombstone)
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_uid` (`user_id`, `uid`),
  KEY `idx_user_created` (`user_id`, `created_at`),
  KEY `idx_user_rev` (`user_id`, `rev`),
  CONSTRAINT `fk_el_act_user` FOREIGN KEY (`user_id`)
    REFERENCES `easylogger_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `easylogger_timers` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED    NOT NULL,
  `uid`           VARCHAR(64)     NOT NULL,
  `position`      INT UNSIGNED    NOT NULL DEFAULT 0,
  `state`         VARCHAR(10)     NOT NULL DEFAULT 'idle',  -- idle | running | paused
  `session_start` BIGINT          NULL DEFAULT NULL,        -- epoch ms della sessione in corso
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

CREATE TABLE IF NOT EXISTS `easylogger_password_resets` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `token`      CHAR(64)     NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `used`       TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_token` (`token`),
  CONSTRAINT `fk_el_reset_user` FOREIGN KEY (`user_id`)
    REFERENCES `easylogger_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `easylogger_user_labels` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL,
  `label_id`   VARCHAR(40)  NOT NULL,
  `label_text` VARCHAR(60)  NOT NULL,
  `bg`         VARCHAR(40)  NOT NULL,
  `color`      VARCHAR(40)  NOT NULL,
  `sort_order` INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_label` (`user_id`, `label_id`),
  CONSTRAINT `fk_el_label_user` FOREIGN KEY (`user_id`)
    REFERENCES `easylogger_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `easylogger_rate_limits` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `bucket`     VARCHAR(20)     NOT NULL,
  `ip`         VARCHAR(45)     NOT NULL,
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bucket_ip_time` (`bucket`, `ip`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
