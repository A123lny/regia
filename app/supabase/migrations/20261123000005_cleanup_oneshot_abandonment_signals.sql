-- Cleanup segnali anti-abbandono "legacy": contatti one-shot segnalati come HIGH.
-- Il detector e' stato aggiornato per non flaggare piu' contatti con un solo
-- ordine (non abbastanza storia per parlare di "abbandono"), ma i segnali
-- preesistenti rimangono in abandonment_signals. Qui li risolviamo con una
-- nota di riconciliazione retrostorica — niente elimina righe (audit trail).

update public.abandonment_signals
set resolved_at = now(),
    resolved_reason = 'Nuove soglie anti-abbandono: richiedono almeno 2 ordini'
where resolved_at is null
  and previous_orders_count <= 1;
