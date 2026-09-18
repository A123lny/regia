-- F1.5b-α: corregge approved_has_timestamp per stati downstream (RF-3.5, RS-3).
-- Il vincolo originale usava biconditionale stretto (status='approved') ↔ (approved_at IS NOT NULL).
-- Con scheduled/published approved_at rimane valorizzato (schedule_after_approve lo richiede),
-- quindi il biconditionale va esteso a tutti gli stati downstream di 'approved'.

ALTER TABLE content_drafts
  DROP CONSTRAINT approved_has_timestamp;

ALTER TABLE content_drafts
  ADD CONSTRAINT approved_has_timestamp
    CHECK (
      (approved_at IS NOT NULL) = (status IN ('approved', 'scheduled', 'published'))
    );
