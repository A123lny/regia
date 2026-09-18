-- M4-γ (RF-4.5): 5 colonne image_* su content_drafts + 5 CHECK + bucket Storage content-media + 4 RLS policy.

-- 1. Colonne
ALTER TABLE content_drafts
  ADD COLUMN image_url text,
  ADD COLUMN image_prompt text,
  ADD COLUMN image_model text,
  ADD COLUMN image_cost_usd numeric(10, 4),
  ADD COLUMN image_generated_at timestamptz;

-- 2. CHECK individuali
ALTER TABLE content_drafts
  ADD CONSTRAINT image_prompt_length
    CHECK (image_prompt IS NULL OR char_length(image_prompt) BETWEEN 1 AND 2000),
  ADD CONSTRAINT image_model_enum
    CHECK (image_model IS NULL OR image_model IN ('flux-dev', 'flux-schnell')),
  ADD CONSTRAINT image_cost_non_negative
    CHECK (image_cost_usd IS NULL OR image_cost_usd >= 0);

-- 3. CHECK all-or-nothing
ALTER TABLE content_drafts
  ADD CONSTRAINT image_all_or_nothing
    CHECK (
      (image_url IS NULL AND image_prompt IS NULL AND image_model IS NULL
       AND image_cost_usd IS NULL AND image_generated_at IS NULL)
      OR
      (image_url IS NOT NULL AND image_prompt IS NOT NULL AND image_model IS NOT NULL
       AND image_cost_usd IS NOT NULL AND image_generated_at IS NOT NULL)
    );

-- 4. Bucket Storage content-media (privato, no public URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-media',
  'content-media',
  false,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 5. RLS policy su storage.objects per bucket content-media (org-scoped)
CREATE POLICY "content_media_org_owner_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'content-media'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM users_profile WHERE user_id = auth.uid()
  )
);

CREATE POLICY "content_media_org_owner_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'content-media'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM users_profile WHERE user_id = auth.uid()
  )
);

CREATE POLICY "content_media_org_owner_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'content-media'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM users_profile WHERE user_id = auth.uid()
  )
);

CREATE POLICY "content_media_org_owner_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'content-media'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM users_profile WHERE user_id = auth.uid()
  )
);
