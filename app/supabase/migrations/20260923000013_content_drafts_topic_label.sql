-- RF-12.2 topic_label: etichetta di argomento per drafts (filtro archivio + equilibrio editoriale RF-12.3).
-- Enum ristretto ai valori citati nel capitolato §5.12: officina, bar, consegna, promozione, avviso, ricorrenza, altro.
-- Nullable: drafts legacy pre-migration restano senza label; il classifier li può popolare via backfill futuro.

alter table content_drafts
  add column if not exists topic_label text;

alter table content_drafts
  drop constraint if exists content_drafts_topic_label_check;

alter table content_drafts
  add constraint content_drafts_topic_label_check
  check (topic_label is null or topic_label in ('officina','bar','consegna','promozione','avviso','ricorrenza','altro'));

create index if not exists idx_content_drafts_topic_label
  on content_drafts(organization_id, topic_label)
  where topic_label is not null;
