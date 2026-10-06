-- RF-9.3 Attribuzione contenuto -> vendita.
-- Il capitolato: "Strumenti di collegamento contenuto -> vendita, in ordine di
-- affidabilita: codice o QR nel contenuto, prenotazione online officina
-- (collegamento completo), domanda in cassa (indicazione)."
--
-- Soluzione: ogni voucher porta OPZIONALMENTE l'id del draft da cui e' nato.
-- Nullable: un voucher emesso al banco o automaticamente dal signup non ha un
-- draft di origine ed e' legittimo che resti NULL ("non attribuito").
--
-- ON DELETE SET NULL: cancellare un draft non deve far perdere il voucher emesso.
-- Analytics M08 potra' aggregare per source_draft_id JOIN content_drafts.

alter table vouchers
  add column if not exists source_draft_id uuid
    references content_drafts(id) on delete set null;

create index if not exists idx_vouchers_source_draft
  on vouchers(source_draft_id)
  where source_draft_id is not null;

comment on column vouchers.source_draft_id is
  'RF-9.3: draft M03 da cui e'' nato questo voucher (QR/codice nel contenuto). NULL = emesso al banco o automatico (es. welcome signup).';
