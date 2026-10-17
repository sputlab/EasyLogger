<?php
/* ==========================================================
   EasyLogger — Costanti applicative / App constants
   Unica fonte della versione (MAJOR.MINOR.PATCH).
========================================================== */
const APP_NAME    = 'EasyLogger';
const APP_VERSION = '4.0.0';

/* Prefisso di tutte le tabelle del database */
const DB_PREFIX = 'easylogger_';

const TBL_USERS       = DB_PREFIX . 'users';
const TBL_ACTIVITIES  = DB_PREFIX . 'activities';
const TBL_RESETS      = DB_PREFIX . 'password_resets';
const TBL_LABELS      = DB_PREFIX . 'user_labels';
const TBL_TIMERS      = DB_PREFIX . 'timers';        // 4.0: un record per timer
const TBL_TIMERS_OLD  = DB_PREFIX . 'user_timers';   // 3.x: blob JSON (migrato al primo accesso)
const TBL_RATE_LIMITS = DB_PREFIX . 'rate_limits';

/* Regole account */
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 8;   // le password esistenti più corte continuano a funzionare

/* Sincronizzazione */
const SYNC_MAX_OPS        = 200;   // operazioni per singola richiesta push
const SYNC_FULL_LIMIT     = 1000;  // attività restituite da una sync completa
const TOMBSTONE_KEEP_DAYS = 90;    // dopo quanto eliminare fisicamente i record cancellati
