-- Campagne: campo testo messaggio diretto (senza passare da content_drafts).
-- Finora il testo poteva solo arrivare via content_draft_id, bloccando casi
-- semplici come "manda questa frase a tutti i clienti dormienti".

alter table public.campaigns
  add column if not exists message_text text;

comment on column public.campaigns.message_text is
  'Testo del messaggio della campagna, usato se content_draft_id e'' null. Max 2000 char applicativo.';
