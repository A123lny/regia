-- M08 Recensioni e reputazione (RF-8.1..8.9, RN-61)
-- Google Place ID per brand: fetcher Places API read-only.
-- Nullable: brand senza scheda Google (es. Lenny food via piattaforme terze).

alter table brands add column google_place_id text null;
comment on column brands.google_place_id is 'Google Place ID per fetch recensioni M08. Null = brand senza scheda Google.';
