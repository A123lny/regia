-- F1.5b-α: estende content_draft_status con 'scheduled' e 'published' (RF-3.5).
-- ALTER TYPE ADD VALUE non può stare in transazione con altri DDL: file dedicato.

ALTER TYPE content_draft_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE content_draft_status ADD VALUE IF NOT EXISTS 'published';
