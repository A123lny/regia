-- M1 Data Hub Blocco 2 — catalogo prodotti/servizi + ordini + storico prezzi.
-- RF-1.2 modello canonico (prodotto/servizio, vendita/ordine, margine).
-- RF-1.5 storico prezzi e costi con data di validità.
-- RF-6.11 margine minimo come valore vivo modificabile con storico.
-- RN-87 organization_id su ogni tabella.
-- Prezzi in centesimi (int) per evitare floating-point drift.

-- ============================================================================
-- 1. brand_products — catalogo per brand
-- ============================================================================

create table if not exists brand_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  sku text not null,
  name text not null,
  category text not null,
  unit text not null check (unit in ('pezzo','litro','kg','ora','servizio')),
  price_current_cents int check (price_current_cents is null or price_current_cents >= 0),
  cost_current_cents int check (cost_current_cents is null or cost_current_cents >= 0),
  min_margin_pct numeric(5,2) check (min_margin_pct is null or (min_margin_pct >= 0 and min_margin_pct <= 100)),
  source text not null check (source in ('manuale','gestionale','import')),
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, brand_id, sku),
  constraint brand_products_name_length check (length(trim(name)) > 0),
  constraint brand_products_sku_length check (length(trim(sku)) > 0)
);

create index if not exists idx_products_org_brand on brand_products(organization_id, brand_id);
create index if not exists idx_products_category on brand_products(organization_id, brand_id, category);
create index if not exists idx_products_source on brand_products(organization_id, source);
create index if not exists idx_products_active on brand_products(organization_id, brand_id, created_at desc)
  where archived_at is null;

-- Trigger updated_at riutilizza la funzione condivisa creata in migrazione contacts
drop trigger if exists trg_products_touch_updated_at on brand_products;
create trigger trg_products_touch_updated_at
before update on brand_products
for each row execute function contacts_touch_updated_at();

alter table brand_products enable row level security;
drop policy if exists "products_service_role_all" on brand_products;
create policy "products_service_role_all"
on brand_products for all
to service_role
using (true) with check (true);

-- ============================================================================
-- 2. brand_product_prices — RF-1.5 storico prezzi/costi con validità
-- ============================================================================
-- Append-only: ogni cambio prezzo/costo scrive un nuovo record.
-- valid_from richiesto, valid_to opzionale (null = ancora in vigore).
-- Un solo record per (product, valid_to IS NULL) — il "prezzo corrente" è unico.

create table if not exists brand_product_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  product_id uuid not null references brand_products(id) on delete cascade,
  price_cents int not null check (price_cents >= 0),
  cost_cents int check (cost_cents is null or cost_cents >= 0),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  note text,
  changed_by uuid, -- FK molle su auth.users, senza vincolo per resistere a delete utente
  created_at timestamptz not null default now(),
  constraint prices_validity_range check (valid_to is null or valid_to > valid_from)
);

-- UNIQUE parziale: solo un record "aperto" (valid_to null) per prodotto
create unique index if not exists uq_product_price_open
  on brand_product_prices(product_id)
  where valid_to is null;

create index if not exists idx_prices_product_time on brand_product_prices(product_id, valid_from desc);
create index if not exists idx_prices_org on brand_product_prices(organization_id, valid_from desc);

alter table brand_product_prices enable row level security;
drop policy if exists "product_prices_service_role_all" on brand_product_prices;
create policy "product_prices_service_role_all"
on brand_product_prices for all
to service_role
using (true) with check (true);

-- ============================================================================
-- 3. brand_orders — testata ordini/vendite
-- ============================================================================
-- contact_id nullable: cliente ospite (banco, casse anonime).
-- external_ref: ID nel gestionale sorgente (RF-1.1 quando arriverà sync).
-- total_cents ricalcolato da trigger sulle righe (coerenza garantita in DB).

create table if not exists brand_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  contact_id uuid references contacts(id) on delete set null,
  external_ref text,
  channel text not null check (channel in ('delivery','pickup','store','officina','carburante','online','altro')),
  status text not null check (status in ('pending','completed','cancelled','refunded')),
  total_cents int not null default 0 check (total_cents >= 0),
  currency text not null default 'EUR' check (currency in ('EUR')),
  placed_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, brand_id, external_ref),
  -- Coerenza timestamp completato
  constraint orders_completed_coherent
    check (
      (status in ('completed','refunded') and completed_at is not null) or
      (status not in ('completed','refunded') and completed_at is null) or
      (status = 'refunded' and completed_at is not null)
    )
);

create index if not exists idx_orders_org_brand on brand_orders(organization_id, brand_id);
create index if not exists idx_orders_contact on brand_orders(contact_id) where contact_id is not null;
create index if not exists idx_orders_placed_at on brand_orders(organization_id, placed_at desc);
create index if not exists idx_orders_status on brand_orders(organization_id, status);

drop trigger if exists trg_orders_touch_updated_at on brand_orders;
create trigger trg_orders_touch_updated_at
before update on brand_orders
for each row execute function contacts_touch_updated_at();

alter table brand_orders enable row level security;
drop policy if exists "orders_service_role_all" on brand_orders;
create policy "orders_service_role_all"
on brand_orders for all
to service_role
using (true) with check (true);

-- ============================================================================
-- 4. brand_order_lines — righe ordine
-- ============================================================================
-- product_id nullable: consente righe libere ("altro", "servizio a preventivo").
-- name_snapshot: nome del prodotto al momento della vendita (RF-1.5 storicità).
-- line_total_cents = unit_price_cents * quantity, mantenuto dal trigger.

create table if not exists brand_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references brand_orders(id) on delete cascade,
  product_id uuid references brand_products(id) on delete set null,
  name_snapshot text not null,
  unit_price_cents int not null check (unit_price_cents >= 0),
  quantity numeric(10,3) not null check (quantity > 0),
  line_total_cents int not null check (line_total_cents >= 0),
  created_at timestamptz not null default now(),
  constraint lines_name_length check (length(trim(name_snapshot)) > 0)
);

create index if not exists idx_order_lines_order on brand_order_lines(order_id);
create index if not exists idx_order_lines_product on brand_order_lines(product_id) where product_id is not null;

alter table brand_order_lines enable row level security;
drop policy if exists "order_lines_service_role_all" on brand_order_lines;
create policy "order_lines_service_role_all"
on brand_order_lines for all
to service_role
using (true) with check (true);

-- Trigger: mantenere line_total_cents e brand_orders.total_cents coerenti (RS-3).
create or replace function order_lines_recompute_total()
returns trigger language plpgsql as $$
declare
  v_order_id uuid;
  v_total int;
begin
  -- Determina l'order_id target a seconda dell'operazione
  if tg_op = 'DELETE' then
    v_order_id := old.order_id;
  else
    -- Ricalcola line_total_cents sulla riga in inserimento/update
    new.line_total_cents := round(new.unit_price_cents * new.quantity)::int;
    v_order_id := new.order_id;
  end if;

  -- Ricalcola il totale ordine dalla somma delle righe
  select coalesce(sum(line_total_cents), 0) into v_total
  from brand_order_lines where order_id = v_order_id;

  update brand_orders set total_cents = v_total, updated_at = now() where id = v_order_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_lines_recompute on brand_order_lines;
create trigger trg_order_lines_recompute
before insert or update of unit_price_cents, quantity on brand_order_lines
for each row execute function order_lines_recompute_total();

drop trigger if exists trg_order_lines_recompute_after on brand_order_lines;
create trigger trg_order_lines_recompute_after
after insert or update or delete on brand_order_lines
for each row execute function order_lines_recompute_total();
