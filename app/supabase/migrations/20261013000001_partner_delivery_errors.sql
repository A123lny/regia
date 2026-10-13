-- RN-28 Conteggio errori consegna per ristorante.
-- Capitolato: "uno al mese e' fisiologico, tre e' allarme".
--
-- Modelliamo gli errori come eventi dedicati: ogni errore e' un record qui.
-- Opzionalmente linkato a un voucher di scuse (quello che e' stato emesso al
-- cliente danneggiato) e all'ordine origine. Mantenere tabella separata da
-- partner_activities perche' semanticamente diverso: le activity sono log di
-- RELAZIONE con il ristoratore (chiamate/incontri), gli errori sono eventi
-- OPERATIVI (ordine andato male) che si contano nel tempo.

create table partner_delivery_errors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  partner_id uuid not null references partner_restaurants(id) on delete cascade,
  order_id uuid references brand_orders(id) on delete set null,
  compensation_voucher_id uuid references vouchers(id) on delete set null,
  reason text not null check (length(trim(reason)) between 3 and 500),
  severity text not null default 'media'
    check (severity in ('bassa', 'media', 'alta')),
  occurred_at timestamptz not null default now(),
  reported_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index idx_delivery_errors_partner
  on partner_delivery_errors(partner_id, occurred_at desc);
create index idx_delivery_errors_org
  on partner_delivery_errors(organization_id, occurred_at desc);
create index idx_delivery_errors_voucher
  on partner_delivery_errors(compensation_voucher_id)
  where compensation_voucher_id is not null;

alter table partner_delivery_errors enable row level security;
create policy "delivery_errors_service_role_all"
  on partner_delivery_errors for all to service_role using (true) with check (true);

comment on table partner_delivery_errors is
  'RN-28: eventi di errore consegna/servizio con ristorante responsabile. Soglie: 1/mese fisiologico, 3/mese = allarme.';
comment on column partner_delivery_errors.compensation_voucher_id is
  'Voucher di scuse emesso al cliente (opzionale, nullable per compat).';
