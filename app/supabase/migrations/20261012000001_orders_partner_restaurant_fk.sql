-- RN-47 Report mensile ristoratori: brand_orders -> partner_restaurants.
-- FK nullable: ordini storici restano non attribuiti, i nuovi ordini
-- importati via connettore M1 reale (RF-1.6 futuro) popoleranno questo campo.
-- ON DELETE SET NULL: eliminare un ristorante partner non deve far perdere lo
-- storico ordini (dati commerciali), solo l'attribuzione.

alter table brand_orders
  add column if not exists partner_restaurant_id uuid
    references partner_restaurants(id) on delete set null;

create index if not exists idx_brand_orders_partner_restaurant
  on brand_orders(partner_restaurant_id)
  where partner_restaurant_id is not null;

comment on column brand_orders.partner_restaurant_id is
  'RN-47: ristorante Lenny che ha evaso l''ordine (nullable per ordini pre-connettori). Popolato dal connettore gestionale Lenny quando attivo.';
