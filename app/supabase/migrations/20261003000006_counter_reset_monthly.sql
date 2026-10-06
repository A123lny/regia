-- RF-6.21 Soglie contatori a tempo: aggiunge l'azzeramento MENSILE.
-- Capitolato (RF-6.21 + §15.C): "soglie piu' basse e ripetute, o a tempo
-- ('3 ordini questo mese')". Oggi avevamo solo 'dopo_premio', 'annuale', 'mai';
-- 'mensile' arriva ora come opzione configurabile, taratura reale quando il
-- Data Hub mostra i numeri veri (eventi gestionali reali).
--
-- La logica di reset runtime non viene eseguita qui: oggi resetMode e' solo
-- un valore di configurazione tracciato per l'Owner. Quando colleghiamo gli
-- eventi gestionali reali e un worker periodico lo userera' per azzerare i
-- counter_events / le progressioni.

alter table loyalty_counters
  drop constraint if exists loyalty_counters_reset_mode_check;

alter table loyalty_counters
  add constraint loyalty_counters_reset_mode_check
  check (reset_mode in ('dopo_premio', 'mensile', 'annuale', 'mai'));

comment on column loyalty_counters.reset_mode is
  'RF-6.21: quando il contatore si azzera. dopo_premio (default), mensile, annuale, mai. Taratura su dati reali §15.C.';
