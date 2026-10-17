-- ==========================================================
--  EasyLogger — Migrazione 3.2.x → 3.3.0
--  (se arrivi dalla 3.1, esegui prima migrate_3.1.0_to_3.2.0.sql)
--
--  Fino alla 3.2.1 il logout impostava list_cleared_at = NOW():
--  le attività restavano nel DB ma venivano nascoste dalla home,
--  su TUTTI i device dell'utente. Questo script le rende di nuovo visibili.
--
--  ⚠ Annulla anche eventuali "Reset lista" fatti con la 3.2.x.
--    Se vuoi conservarli, salta questo script: da ora il logout
--    non nasconde più nulla e la lista si svuota solo con "Reset lista".
-- ==========================================================

UPDATE `easylogger_users` SET `list_cleared_at` = NULL;
