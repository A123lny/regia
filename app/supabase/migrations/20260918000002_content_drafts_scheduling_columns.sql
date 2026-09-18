-- F1.5b-α: aggiunge scheduling a content_drafts (RF-3.5).
-- 2 colonne timestamptz + 3 CHECK constraint + 1 index parziale su (brand_id, scheduled_at).

ALTER TABLE content_drafts
  ADD COLUMN scheduled_at timestamptz,
  ADD COLUMN published_at timestamptz,
  ADD CONSTRAINT schedule_has_timestamp
    CHECK (status <> 'scheduled' OR scheduled_at IS NOT NULL),
  ADD CONSTRAINT publish_has_timestamp
    CHECK (status <> 'published' OR (published_at IS NOT NULL AND scheduled_at IS NOT NULL)),
  ADD CONSTRAINT schedule_after_approve
    CHECK (scheduled_at IS NULL OR (approved_at IS NOT NULL AND scheduled_at > approved_at));

CREATE INDEX content_drafts_scheduled_at_idx
  ON content_drafts (brand_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL;
