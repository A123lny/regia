# M4-γ Implementation Plan — Generazione immagini AI (fal.ai FLUX)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere generazione immagini AI su fal.ai (modello FLUX) ai draft social esistenti di m03-editorial: bottone dettaglio draft → Claude suggerisce prompt inglese → Owner conferma/modifica → fal.ai genera → salvataggio in Supabase Storage privato con RLS org-scoped.

**Architecture:** Estensione di `m03-editorial` (no nuovo modulo). Nuovo adapter `lib/ai/fal.ts` (unica porta a fal.ai). 5 colonne aggiunte a `content_drafts` con CHECK all-or-nothing. Nuovo bucket Storage `content-media` privato con RLS per org. UI aggiunta al dettaglio draft esistente + thumbnail su lista/calendario.

**Tech Stack:** Next.js 16 App Router + React 19 Server Actions, Supabase Postgres + Storage, TypeScript strict, Tailwind + shadcn/ui, fetch HTTP (no SDK fal.ai), vitest per test.

**Spec:** `docs/superpowers/specs/2026-09-18-m4-gamma-image-generation-design.md`

## Global Constraints

- **RQ-1** ID nei commit + convenzione `<IDs>: <descrizione italiano>`.
- **RQ-7** Ogni task chiude con `cd app && npm run ci` verde (lint + format + typecheck + boundaries + migrazioni + 62→75 test) e `git push origin feature/m4-gamma-image-generation`.
- **RS-1** Boundaries dep-cruiser: UI importa da `m03-editorial/public`, mai da internal. Adapter fal.ai importato solo da `internal/generate-image.ts`.
- **RS-2** `lib/ai/fal.ts` è unica porta a fal.ai. Nessun altro file può fare `fetch` verso `fal.run`.
- **RS-3** 5 CHECK constraints DB nuovi (4 individuali + 1 all-or-nothing) + RLS bucket Storage.
- **RS-6** Server Actions React 19 `"use server"`, `next/navigation` router.refresh(), Supabase Storage JS SDK, fetch nativo per fal.ai.
- **RS-8** Migrazione filename `20260918000004_content_drafts_image_columns.sql` (14 cifre continue: 20260918 + 000004).
- **RN-72** System prompt Claude per image-prompt-composer include: "NON inventare dati concreti (prezzi, orari, date, nomi)".
- **RN-87** Repo functions tenant-scoped `organizationId` parametro obbligatorio.
- **RU-1a** M4-γ solo Owner: server actions e RSC chiamano `notFound()` se non owner.
- **RA-8.5** Server actions tipizzate, autorizzazione applicata dal codice.
- **RA-8.12** Audit obbligatorio per `editorial.draft_image_generated` + `editorial.draft_image_deleted`. Suggest prompt (read-only) senza audit.
- **RF-4.5** Adapter fal.ai intercambiabile, no dipendenza SDK.
- **RF-5.7** Log immutabile: draft `published`/`rejected` → immagine immutabile (status guard app-level).
- **RF-11.3** `logAuditEvent` con `target: brand:<slug>` + details = `{draftId, model, costUsd, promptLength, promptHash}` (NO prompt full).
- **RNF-1** `FAL_API_KEY` non nel repo. Card `/impostazioni` estesa server-side con maschera parziale.
- **RNF-9** Fallback fal.ai down: server action ritorna `{ok:false, error}`, no partial state.

**Lingua:** identificatori codice inglese; UI/commenti/docs italiano; prompt AI immagine in inglese (FLUX).

**Baseline:** branch `feature/f1-1-layout-shell` HEAD `5f4706e` — include F1.5a + hotfix RNF-9 + F1.5b-α + spec M4-γ. Test totali baseline: **62**. Target fine cantiere: **75**.

**Branch cantiere:** `feature/m4-gamma-image-generation` da `feature/f1-1-layout-shell`.

**API keys richieste:**
- `ANTHROPIC_API_KEY` (già configurata da F1.5a — per suggest prompt)
- `FAL_API_KEY` (nuova — Owner registra su https://fal.ai, free tier $10)

---

## File Structure

**Migrazione DB nuova:**
- `app/supabase/migrations/20260918000004_content_drafts_image_columns.sql` — 5 colonne + 5 CHECK + bucket content-media + 4 RLS policy

**Modulo `m03-editorial` (modifiche):**
- `app/src/modules/m03-editorial/internal/content-drafts-types.ts` — aggiunge 5 campi image nullable a `ContentDraft`
- `app/src/modules/m03-editorial/internal/content-drafts-repo.ts` — +3 funzioni (`setDraftImage`, `clearDraftImage`, `getDraftImagePath`) + update `rowToDraft` + `SELECT_COLS`
- `app/src/modules/m03-editorial/internal/image-prompt-composer.ts` — NEW, funzione pura compose system+user message per Claude
- `app/src/modules/m03-editorial/internal/prompts/image-prompt.md` — NEW, template Claude
- `app/src/modules/m03-editorial/internal/generate-image.ts` — NEW, orchestratore call fal.ai + upload Storage + cleanup
- `app/src/modules/m03-editorial/internal/actions.ts` — +3 server actions
- `app/src/modules/m03-editorial/public.ts` — export 3 actions

**Adapter esterno nuovo:**
- `app/src/lib/ai/fal.ts` — unica porta a fal.ai API

**Componenti UI nuovi:**
- `app/src/components/media/image-thumbnail.tsx` — RSC async helper
- `app/src/app/(protected)/contenuti/[slug]/[draftId]/image-section.tsx` — client component

**Route UI (modifiche):**
- `app/src/app/(protected)/contenuti/[slug]/[draftId]/page.tsx` — aggiunge ImageSection + signed URL fetch
- `app/src/app/(protected)/contenuti/[slug]/page.tsx` — aggiunge ImageThumbnail nella lista
- `app/src/app/(protected)/contenuti/[slug]/calendario/page.tsx` — pre-genera signed URLs, passa a client chain
- `app/src/app/(protected)/contenuti/[slug]/calendario/calendar-client.tsx` — nuova prop
- `app/src/app/(protected)/contenuti/[slug]/calendario/biweekly-grid.tsx` — passa prop
- `app/src/app/(protected)/contenuti/[slug]/calendario/droppable-cell.tsx` — aggiunge thumbnail
- `app/src/app/(protected)/impostazioni/page.tsx` — estende card Chiavi AI con FAL_API_KEY

**Test nuovi (5 file, 13 asserzioni):**
- `app/tests/invariants/content-draft-image-all-or-nothing.test.ts` — 3 asserzioni
- `app/tests/invariants/content-draft-image-column-checks.test.ts` — 4 asserzioni
- `app/tests/invariants/content-media-storage-rls.test.ts` — 2 asserzioni
- `app/tests/invariants/content-drafts-image-tenant-scoping.test.ts` — 2 asserzioni
- `app/tests/invariants/content-draft-image-published-immutable.test.ts` — 2 asserzioni

**Env config:**
- `app/.env.local.example` — aggiunge `FAL_API_KEY=`

**Documentazione:**
- `docs/diario.md` — aggiornato in T11

---

## Task 0: Setup branch

**Files:** nessuno

**Interfaces:**
- Consumes: `feature/f1-1-layout-shell` HEAD `5f4706e`
- Produces: nuovo branch `feature/m4-gamma-image-generation` locale + remote

- [ ] **Step 1: Verifica baseline**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git status
git log --oneline -1
```
Expected: working tree pulito, branch = `feature/f1-1-layout-shell`, HEAD = `5f4706e`.

- [ ] **Step 2: Verifica CI 62/62**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, `Tests 62 passed (62)`.

- [ ] **Step 3: Crea branch**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git checkout -b feature/m4-gamma-image-generation
git push -u origin feature/m4-gamma-image-generation
```

**Nessun commit in T0.**

---

## Task 1: Env config template + FAL_API_KEY

**Files:**
- Modify: `app/.env.local.example`

**Interfaces:**
- Consumes: nessuna
- Produces: template env con `FAL_API_KEY=` vuota, pronto per Owner-side setup

- [ ] **Step 1: Aggiorna `.env.local.example`**

Append in fondo al file (mantieni le sezioni esistenti F1.5a):

```
# --- M4-γ Immagini AI ---
# fal.ai — FLUX (dev+schnell) per generazione immagini social (RS-2, §5.4 RF-4.5).
# Chiave da https://fal.ai (free tier $10 iniziali).
FAL_API_KEY=
```

- [ ] **Step 2: Verifica CI**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: 62/62.

- [ ] **Step 3: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/.env.local.example
git commit -m "RNF-1 RS-2: template FAL_API_KEY in .env.local.example (M4-gamma)"
git push origin feature/m4-gamma-image-generation
```

---

## Task 2: Migrazione DB + Storage bucket + RLS + 3 test file (9 asserzioni)

**Files:**
- Create: `app/supabase/migrations/20260918000004_content_drafts_image_columns.sql`
- Create: `app/tests/invariants/content-draft-image-all-or-nothing.test.ts`
- Create: `app/tests/invariants/content-draft-image-column-checks.test.ts`
- Create: `app/tests/invariants/content-media-storage-rls.test.ts`

**Interfaces:**
- Consumes: schema `content_drafts` esistente + `storage.buckets` + `storage.objects`
- Produces: 5 colonne image_* nullable + 5 CHECK + bucket `content-media` privato + 4 RLS policy

- [ ] **Step 1: Scrivi test all-or-nothing (TDD RED)**

Create `app/tests/invariants/content-draft-image-all-or-nothing.test.ts`:

```typescript
// RS-3 §4.2: CHECK image_all_or_nothing — tutti e 5 i campi image_* valorizzati insieme o tutti NULL.
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("content_drafts: CHECK image_all_or_nothing (RS-3)", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — image all-or-nothing" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org fallito: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-img-aon-${orgId.slice(0, 8)}`,
        display_name: "Brand Image AON",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data)
      throw new Error(`Setup brand fallito: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  const baseDraft = () => ({
    organization_id: orgId,
    brand_id: brandId,
    channel: "social",
    theme_input: "test image aon",
    generated_text: "testo",
    prompt_version: "v1",
    model_used: "m",
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
  });

  it("stato parziale (solo image_url valorizzato) fallisce CHECK", async () => {
    const res = await admin.from("content_drafts").insert({
      ...baseDraft(),
      image_url: "test/path.jpg",
      image_prompt: null,
      image_model: null,
      image_cost_usd: null,
      image_generated_at: null,
    });
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/image_all_or_nothing|check/);
  });

  it("tutti i campi image_* NULL riesce (draft senza immagine)", async () => {
    const res = await admin.from("content_drafts").insert(baseDraft()).select("id").single();
    expect(res.error).toBeNull();
    expect(res.data).not.toBeNull();
  });

  it("tutti i campi image_* valorizzati riesce", async () => {
    const res = await admin
      .from("content_drafts")
      .insert({
        ...baseDraft(),
        image_url: `${orgId}/test-aon.jpg`,
        image_prompt: "test prompt",
        image_model: "flux-dev",
        image_cost_usd: 0.025,
        image_generated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    expect(res.error).toBeNull();
    expect(res.data).not.toBeNull();
  });
});
```

- [ ] **Step 2: Scrivi test column checks (TDD RED)**

Create `app/tests/invariants/content-draft-image-column-checks.test.ts`:

```typescript
// RS-3 §4.2: CHECK individuali su image_prompt (length 1..2000), image_model (enum), image_cost_usd (>=0).
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("content_drafts: CHECK individuali su colonne image_* (RS-3)", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — image column checks" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org fallito: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-img-col-${orgId.slice(0, 8)}`,
        display_name: "Brand Image Col",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data)
      throw new Error(`Setup brand fallito: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  const withImage = (overrides: Record<string, unknown>) => ({
    organization_id: orgId,
    brand_id: brandId,
    channel: "social",
    theme_input: "test image col",
    generated_text: "testo",
    prompt_version: "v1",
    model_used: "m",
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    image_url: `${orgId}/test-col.jpg`,
    image_prompt: "valid prompt",
    image_model: "flux-dev",
    image_cost_usd: 0.025,
    image_generated_at: new Date().toISOString(),
    ...overrides,
  });

  it("image_prompt vuoto fallisce CHECK length", async () => {
    const res = await admin.from("content_drafts").insert(withImage({ image_prompt: "" }));
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/image_prompt_length|check/);
  });

  it("image_prompt >2000 char fallisce CHECK length", async () => {
    const res = await admin
      .from("content_drafts")
      .insert(withImage({ image_prompt: "a".repeat(2001) }));
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/image_prompt_length|check/);
  });

  it("image_model non in enum fallisce CHECK", async () => {
    const res = await admin.from("content_drafts").insert(withImage({ image_model: "sdxl" }));
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/image_model_enum|check/);
  });

  it("image_cost_usd negativo fallisce CHECK", async () => {
    const res = await admin.from("content_drafts").insert(withImage({ image_cost_usd: -0.01 }));
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/image_cost_non_negative|check/);
  });
});
```

- [ ] **Step 3: Scrivi test Storage RLS (TDD RED)**

Create `app/tests/invariants/content-media-storage-rls.test.ts`:

```typescript
// RS-3 §4.4: RLS bucket content-media denial-by-default per anon.
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const ANON_KEY = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "";
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });

describe("Storage bucket content-media: RLS anon (RS-3)", () => {
  it("anon prova list bucket content-media → permission denied o lista vuota", async () => {
    const { data, error } = await anon.storage.from("content-media").list("00000000-0000-0000-0000-000000000001/");
    // Anon senza policy: o error 403 o data vuota (nessun accesso).
    if (error) {
      expect(error.message.toLowerCase()).toMatch(/permission|denied|not authorized|not allowed|policy/);
    } else {
      expect(data).toEqual([]);
    }
  });

  it("anon prova upload su content-media → error permission denied", async () => {
    const testBytes = new Uint8Array([137, 80, 78, 71]); // fake PNG header
    const { error } = await anon.storage
      .from("content-media")
      .upload(`00000000-0000-0000-0000-000000000001/test-anon.jpg`, testBytes, {
        contentType: "image/jpeg",
      });
    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase()).toMatch(/permission|denied|not authorized|not allowed|policy|violates/);
  });
});
```

- [ ] **Step 4: Esegui test (RED atteso)**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npx dotenv -e .env.local -- npm test -- content-draft-image-all-or-nothing content-draft-image-column-checks content-media-storage-rls 2>&1 | tail -25
```
Expected: 9 test in FAIL con errori tipo `column "image_url" of relation "content_drafts" does not exist` e `bucket not found` o simili.

- [ ] **Step 5: Scrivi migrazione (GREEN)**

Create `app/supabase/migrations/20260918000004_content_drafts_image_columns.sql`:

```sql
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
```

- [ ] **Step 6: Applica migrazione + riesegui test (GREEN)**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npx supabase db reset
npx dotenv -e .env.local -- npm test -- content-draft-image-all-or-nothing content-draft-image-column-checks content-media-storage-rls 2>&1 | tail -15
```
Expected: 9/9 passing.

- [ ] **Step 7: Verifica CI**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, `Tests 71 passed (71)` (era 62, +9).

- [ ] **Step 8: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/supabase/migrations/20260918000004_content_drafts_image_columns.sql app/tests/invariants/content-draft-image-all-or-nothing.test.ts app/tests/invariants/content-draft-image-column-checks.test.ts app/tests/invariants/content-media-storage-rls.test.ts
git commit -m "RF-4.5 RS-3: colonne image_* + bucket content-media + RLS + 9 test invariants"
git push origin feature/m4-gamma-image-generation
```

---

## Task 3: Types + rowToDraft + SELECT_COLS

**Files:**
- Modify: `app/src/modules/m03-editorial/internal/content-drafts-types.ts`
- Modify: `app/src/modules/m03-editorial/internal/content-drafts-repo.ts` (solo `rowToDraft` + `SELECT_COLS`)

**Interfaces:**
- Consumes: 5 colonne DB da T2
- Produces: `ContentDraft` type con 5 nuovi campi image, `rowToDraft` mappa nuove colonne, `SELECT_COLS` include entrambe

- [ ] **Step 1: Estendi `content-drafts-types.ts`**

Modify `app/src/modules/m03-editorial/internal/content-drafts-types.ts`.

Sostituisci il type `ContentDraft` esistente con:

```typescript
export type ContentDraft = {
  id: string;
  organizationId: string;
  brandId: string;
  channel: ContentChannel;
  themeInput: string;
  generatedText: string;
  promptVersion: string;
  modelUsed: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  status: ContentDraftStatus;
  rejectionReason: string | null;
  createdBy: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  imageUrl: string | null;             // path Supabase Storage, es. "{orgId}/{draftId}.jpg" (M4-γ)
  imagePrompt: string | null;          // prompt inglese usato per FLUX (M4-γ)
  imageModel: string | null;           // "flux-dev" o "flux-schnell" (M4-γ)
  imageCostUsd: number | null;         // costo call fal.ai (M4-γ)
  imageGeneratedAt: string | null;     // ISO timestamp (M4-γ)
};
```

- [ ] **Step 2: Aggiorna `rowToDraft` e `SELECT_COLS` in `content-drafts-repo.ts`**

Sostituisci `rowToDraft`:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDraft(row: any): ContentDraft {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    channel: row.channel as ContentChannel,
    themeInput: row.theme_input,
    generatedText: row.generated_text,
    promptVersion: row.prompt_version,
    modelUsed: row.model_used,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    costUsd: Number(row.cost_usd),
    latencyMs: row.latency_ms,
    status: row.status as ContentDraftStatus,
    rejectionReason: row.rejection_reason ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    approvedAt: row.approved_at ?? null,
    rejectedAt: row.rejected_at ?? null,
    scheduledAt: row.scheduled_at ?? null,
    publishedAt: row.published_at ?? null,
    imageUrl: row.image_url ?? null,
    imagePrompt: row.image_prompt ?? null,
    imageModel: row.image_model ?? null,
    imageCostUsd: row.image_cost_usd !== null && row.image_cost_usd !== undefined ? Number(row.image_cost_usd) : null,
    imageGeneratedAt: row.image_generated_at ?? null,
  };
}
```

Sostituisci `SELECT_COLS`:

```typescript
const SELECT_COLS =
  "id, organization_id, brand_id, channel, theme_input, generated_text, " +
  "prompt_version, model_used, tokens_in, tokens_out, cost_usd, latency_ms, " +
  "status, rejection_reason, created_by, created_at, approved_at, rejected_at, " +
  "scheduled_at, published_at, " +
  "image_url, image_prompt, image_model, image_cost_usd, image_generated_at";
```

- [ ] **Step 3: Verifica CI**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 71/71 tests.

- [ ] **Step 4: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/modules/m03-editorial/internal/content-drafts-types.ts app/src/modules/m03-editorial/internal/content-drafts-repo.ts
git commit -m "RF-4.5: ContentDraft type con 5 campi image_* + rowToDraft + SELECT_COLS"
git push origin feature/m4-gamma-image-generation
```

---

## Task 4: Repo functions image + tenant scoping test (2 asserzioni)

**Files:**
- Modify: `app/src/modules/m03-editorial/internal/content-drafts-repo.ts` — +3 funzioni
- Create: `app/tests/invariants/content-drafts-image-tenant-scoping.test.ts` — 2 asserzioni

**Interfaces:**
- Consumes: colonne + types da T2/T3
- Produces:
  - `setDraftImage(draftId, organizationId, data): Promise<ContentDraft | null>`
  - `clearDraftImage(draftId, organizationId): Promise<ContentDraft | null>`
  - `getDraftImagePath(draftId, organizationId): Promise<string | null>`

- [ ] **Step 1: Scrivi test tenant scoping (TDD RED)**

Create `app/tests/invariants/content-drafts-image-tenant-scoping.test.ts`:

```typescript
// RS-3 RN-87: setDraftImage filtra su organization_id — IDOR bloccato.
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { setDraftImage } from "@/modules/m03-editorial/internal/content-drafts-repo";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("setDraftImage: tenant scoping IDOR (RS-3, RN-87)", () => {
  let draftIdOrgA: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — image scoping" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup org-A fallito: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — image scoping" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup org-B fallito: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-img-${orgAId.slice(0, 8)}`,
        display_name: "Brand A Img",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data)
      throw new Error(`Setup brand-A fallito: ${brandA.error?.message}`);
    const brandIdOrgA = (brandA.data as { id: string }).id;

    const draft = await admin
      .from("content_drafts")
      .insert({
        organization_id: orgAId,
        brand_id: brandIdOrgA,
        channel: "social",
        theme_input: "test img scoping",
        generated_text: "testo",
        prompt_version: "v1",
        model_used: "m",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        created_by: null,
      })
      .select("id")
      .single();
    if (draft.error || !draft.data)
      throw new Error(`Setup draft fallito: ${draft.error?.message}`);
    draftIdOrgA = (draft.data as { id: string }).id;
  });

  const validImageData = {
    url: "test/img.jpg",
    prompt: "test prompt",
    model: "flux-dev",
    costUsd: 0.025,
    generatedAt: new Date().toISOString(),
  };

  it("setDraftImage(draftIdOrgA, orgBId, ...) → null (IDOR bloccato)", async () => {
    const result = await setDraftImage(draftIdOrgA, orgBId, validImageData);
    expect(result).toBeNull();
  });

  it("setDraftImage(draftIdOrgA, orgAId, ...) → ContentDraft (accesso legittimo)", async () => {
    const result = await setDraftImage(draftIdOrgA, orgAId, validImageData);
    expect(result).not.toBeNull();
    expect(result?.imageUrl).toBe("test/img.jpg");
    expect(result?.imagePrompt).toBe("test prompt");
    expect(result?.imageModel).toBe("flux-dev");
    expect(result?.imageCostUsd).toBe(0.025);
    expect(result?.organizationId).toBe(orgAId);
  });
});
```

- [ ] **Step 2: Esegui test (RED atteso)**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npx dotenv -e .env.local -- npm test -- content-drafts-image-tenant-scoping 2>&1 | tail -15
```
Expected: 2 test FAIL con `setDraftImage is not a function` o `Cannot find export`.

- [ ] **Step 3: Aggiungi 3 funzioni a `content-drafts-repo.ts`**

Alla fine di `app/src/modules/m03-editorial/internal/content-drafts-repo.ts` aggiungi:

```typescript
export type SetDraftImageInput = {
  url: string;
  prompt: string;
  model: string;
  costUsd: number;
  generatedAt: string;
};

/**
 * Tenant-scoped: aggiorna i 5 campi image_* del draft.
 * Ritorna null se draft non appartiene a organizationId (IDOR bloccato).
 */
export async function setDraftImage(
  draftId: string,
  organizationId: string,
  data: SetDraftImageInput,
): Promise<ContentDraft | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: row, error } = await admin
    .from("content_drafts")
    .update({
      image_url: data.url,
      image_prompt: data.prompt,
      image_model: data.model,
      image_cost_usd: data.costUsd,
      image_generated_at: data.generatedAt,
    })
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore setDraftImage: ${error.message}`);
  return row ? rowToDraft(row) : null;
}

/**
 * Tenant-scoped: azzera tutti i 5 campi image_* del draft.
 */
export async function clearDraftImage(
  draftId: string,
  organizationId: string,
): Promise<ContentDraft | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .update({
      image_url: null,
      image_prompt: null,
      image_model: null,
      image_cost_usd: null,
      image_generated_at: null,
    })
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore clearDraftImage: ${error.message}`);
  return data ? rowToDraft(data) : null;
}

/**
 * Tenant-scoped: ritorna solo image_url path (per generare signed URL o cleanup).
 */
export async function getDraftImagePath(
  draftId: string,
  organizationId: string,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select("image_url")
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore getDraftImagePath: ${error.message}`);
  return (data as { image_url: string | null } | null)?.image_url ?? null;
}
```

- [ ] **Step 4: Riesegui test (GREEN)**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npx dotenv -e .env.local -- npm test -- content-drafts-image-tenant-scoping 2>&1 | tail -10
```
Expected: 2/2 passing.

- [ ] **Step 5: Verifica CI**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, `Tests 73 passed (73)` (era 71, +2).

- [ ] **Step 6: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/modules/m03-editorial/internal/content-drafts-repo.ts app/tests/invariants/content-drafts-image-tenant-scoping.test.ts
git commit -m "RF-4.5 RN-87 RS-3: setDraftImage/clearDraftImage/getDraftImagePath + IDOR test"
git push origin feature/m4-gamma-image-generation
```

---

## Task 5: Adapter fal.ai (`lib/ai/fal.ts`)

**Files:**
- Create: `app/src/lib/ai/fal.ts`

**Interfaces:**
- Consumes: `process.env["FAL_API_KEY"]`, `fetch` globale
- Produces: `generateImage({prompt, model, aspectRatio}): Promise<GenerateImageResult>` + 4 error classes (`FalConfigError`, `FalApiError`, `FalTimeoutError`, `FalDownloadError`)

- [ ] **Step 1: Crea `fal.ts`**

Create `app/src/lib/ai/fal.ts`:

```typescript
// RS-2: unica porta a fal.ai API. Nessun altro file può fare fetch verso fal.run.
// Il modulo m03-editorial passa da qui per generazione immagini (RF-4.5).
//
// fal.ai non ha SDK TypeScript maturo ufficiale — usiamo fetch nativo.
// API docs: https://fal.ai/models/fal-ai/flux/dev, https://fal.ai/models/fal-ai/flux/schnell

export type FluxModel = "flux-dev" | "flux-schnell";
export type FluxAspectRatio = "square_hd" | "portrait_16_9" | "landscape_16_9";

export type GenerateImageInput = {
  prompt: string;
  model?: FluxModel;
  aspectRatio?: FluxAspectRatio;
};

export type GenerateImageResult = {
  imageBytes: Uint8Array;
  contentType: string;
  model: string;
  costUsd: number;
  latencyMs: number;
};

export class FalConfigError extends Error {
  readonly kind = "invalid_config" as const;
  constructor(message: string) {
    super(message);
    this.name = "FalConfigError";
  }
}
export class FalApiError extends Error {
  readonly kind = "api_error" as const;
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FalApiError";
  }
}
export class FalTimeoutError extends Error {
  readonly kind = "timeout" as const;
  constructor(message: string) {
    super(message);
    this.name = "FalTimeoutError";
  }
}
export class FalDownloadError extends Error {
  readonly kind = "download_error" as const;
  constructor(message: string) {
    super(message);
    this.name = "FalDownloadError";
  }
}

const GEN_TIMEOUT_MS = 20_000; // per la generation call
const DOWNLOAD_TIMEOUT_MS = 10_000; // per il download bytes

// Pricing FLUX 2026-09 (aggiornare quando fal.ai cambia listino, verifica ~annuale su https://fal.ai/pricing).
const PRICE_PER_IMAGE_USD: Record<FluxModel, number> = {
  "flux-dev": 0.025,
  "flux-schnell": 0.003,
};

const MODEL_ENDPOINT: Record<FluxModel, string> = {
  "flux-dev": "https://fal.run/fal-ai/flux/dev",
  "flux-schnell": "https://fal.run/fal-ai/flux/schnell",
};

const MODEL_STEPS: Record<FluxModel, number> = {
  "flux-dev": 28,
  "flux-schnell": 4,
};

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const apiKey = process.env["FAL_API_KEY"];
  if (!apiKey) {
    throw new FalConfigError("FAL_API_KEY non impostata (server-only).");
  }
  const model = input.model ?? "flux-dev";
  const aspectRatio = input.aspectRatio ?? "square_hd";
  const endpoint = MODEL_ENDPOINT[model];
  const started = Date.now();

  // 1. Generation call
  const genController = new AbortController();
  const genTimer = setTimeout(() => genController.abort(), GEN_TIMEOUT_MS);

  let genRes: Response;
  try {
    genRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: input.prompt,
        image_size: aspectRatio,
        num_inference_steps: MODEL_STEPS[model],
        num_images: 1,
      }),
      signal: genController.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new FalTimeoutError(`fal.ai timeout ${GEN_TIMEOUT_MS}ms`);
    }
    throw new FalApiError(0, `fal.ai fetch error: ${(err as Error).message}`);
  } finally {
    clearTimeout(genTimer);
  }

  if (!genRes.ok) {
    // Non incapsulare upstream body per RNF-1 (potrebbe contenere echo prompt / dettagli interni).
    throw new FalApiError(genRes.status, `fal.ai error (HTTP ${genRes.status})`);
  }

  const json = (await genRes.json()) as {
    images?: { url: string; width: number; height: number }[];
    timings?: { inference: number };
  };
  const imageUrl = json.images?.[0]?.url;
  if (!imageUrl) {
    throw new FalApiError(500, "fal.ai response senza images[0].url");
  }

  // 2. Download bytes dell'immagine
  const dlController = new AbortController();
  const dlTimer = setTimeout(() => dlController.abort(), DOWNLOAD_TIMEOUT_MS);

  let dlRes: Response;
  try {
    dlRes = await fetch(imageUrl, { signal: dlController.signal });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") {
      throw new FalDownloadError(`fal.ai download timeout ${DOWNLOAD_TIMEOUT_MS}ms`);
    }
    throw new FalDownloadError(`fal.ai download error: ${(err as Error).message}`);
  } finally {
    clearTimeout(dlTimer);
  }

  if (!dlRes.ok) {
    throw new FalDownloadError(`fal.ai download HTTP ${dlRes.status}`);
  }

  const buf = await dlRes.arrayBuffer();
  const imageBytes = new Uint8Array(buf);
  const contentType = dlRes.headers.get("content-type") ?? "image/jpeg";

  const latencyMs = Date.now() - started;
  const costUsd = PRICE_PER_IMAGE_USD[model];

  return { imageBytes, contentType, model, costUsd, latencyMs };
}
```

- [ ] **Step 2: Verifica CI (typecheck + boundaries + tests)**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 73/73 tests. Nessuna violazione dep-cruiser.

- [ ] **Step 3: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/lib/ai/fal.ts
git commit -m "RS-2 RF-4.5: adapter fal.ai per generazione immagini FLUX (dev+schnell)"
git push origin feature/m4-gamma-image-generation
```

---

## Task 6: Composer prompt + template + orchestratore

**Files:**
- Create: `app/src/modules/m03-editorial/internal/prompts/image-prompt.md`
- Create: `app/src/modules/m03-editorial/internal/image-prompt-composer.ts`
- Create: `app/src/modules/m03-editorial/internal/generate-image.ts`

**Interfaces:**
- Consumes: `getAdminClient` (Supabase Storage), `generateImage` da `lib/ai/fal.ts`, `getDraftImagePath` da repo
- Produces:
  - `IMAGE_PROMPT_VERSION` const (es. "image-prompt-v1")
  - `composeImagePromptSystemMessage(): string`
  - `composeImagePromptUserMessage(input): string`
  - `runGenerateImage(input): Promise<RunGenerateImageOutput>`

- [ ] **Step 1: Crea template Claude**

Create `app/src/modules/m03-editorial/internal/prompts/image-prompt.md`:

```markdown
Sei un assistente che scrive prompt tecnici per generatori di immagini AI (FLUX.1).
Ricevi il testo di un post social e il contesto visivo di un marchio.
Restituisci UN SOLO prompt in inglese, adatto a FLUX-dev, che:
- descrive un'immagine coerente col post (soggetto, atmosfera, oggetti visibili)
- include lo stile visivo del marchio (colori, mood, ambientazione, tono emotivo)
- termina sempre con: "photorealistic, natural lighting, no text overlay, 1:1 aspect ratio"
- NON contiene testo che dovrebbe apparire nell'immagine (FLUX non è affidabile su testo leggibile)
- NON inventa dati concreti (prezzi, orari, date, nomi, cifre) che non sono già nel post
- NON menziona marchi terzi con vincoli configurati (es. logo Eni, packaging partner spesa)

Restituisci SOLO il prompt inglese, senza spiegazioni, senza virgolette, in una singola riga.
```

- [ ] **Step 2: Crea composer**

Create `app/src/modules/m03-editorial/internal/image-prompt-composer.ts`:

```typescript
// M03 — Composer prompt per image AI (M4-γ RF-4.5).
// Funzione pura: nessun I/O, nessun side-effect.

import { loadPromptTemplate } from "./prompt-loader";

export const IMAGE_PROMPT_VERSION = "image-prompt-v1";

export type ComposeImagePromptInput = {
  brandDisplayName: string;
  brandContext: string;
  postText: string;
};

export function composeImagePromptSystemMessage(): string {
  return loadPromptTemplate("image-prompt");
}

export function composeImagePromptUserMessage(input: ComposeImagePromptInput): string {
  return (
    `Marchio: ${input.brandDisplayName}\n\n` +
    `Contesto visivo del marchio:\n${input.brandContext}\n\n` +
    `Testo del post social:\n${input.postText}\n\n` +
    `Componi il prompt inglese per l'immagine.`
  );
}
```

- [ ] **Step 3: Crea orchestratore**

Create `app/src/modules/m03-editorial/internal/generate-image.ts`:

```typescript
// M03 — Orchestrazione generazione immagine (M4-γ RF-4.5).
// Chiama fal.ai adapter + upload Supabase Storage + cleanup file precedente.

import { getAdminClient } from "@/lib/db/admin";
import {
  generateImage,
  FalConfigError,
  FalApiError,
  FalTimeoutError,
  FalDownloadError,
  type FluxModel,
} from "@/lib/ai/fal";
import { getDraftImagePath } from "./content-drafts-repo";

const BUCKET = "content-media";

export type RunGenerateImageInput = {
  organizationId: string;
  draftId: string;
  prompt: string;
  model: FluxModel;
};

export type RunGenerateImageOutput =
  | {
      ok: true;
      imagePath: string;
      costUsd: number;
      model: string;
      generatedAt: string;
    }
  | { ok: false; error: string };

export async function runGenerateImage(
  input: RunGenerateImageInput,
): Promise<RunGenerateImageOutput> {
  // 1. Call fal.ai (con fallback graceful RNF-9)
  let result;
  try {
    result = await generateImage({ prompt: input.prompt, model: input.model });
  } catch (err) {
    if (err instanceof FalConfigError) {
      return { ok: false, error: "Servizio immagini AI non configurato (FAL_API_KEY mancante)." };
    }
    if (err instanceof FalTimeoutError) {
      return { ok: false, error: "Servizio immagini AI non disponibile (timeout). Riprova." };
    }
    if (err instanceof FalDownloadError) {
      return { ok: false, error: `Download immagine fallito: ${(err as Error).message}` };
    }
    if (err instanceof FalApiError) {
      return { ok: false, error: `Servizio immagini AI errore ${err.status}. Riprova.` };
    }
    throw err;
  }

  // 2. Fetch path immagine precedente (se esiste) per cleanup post-upload
  const previousPath = await getDraftImagePath(input.draftId, input.organizationId);

  // 3. Upload nuovo file (upsert overwrite se stesso path)
  const newPath = `${input.organizationId}/${input.draftId}.jpg`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(newPath, result.imageBytes, {
    contentType: result.contentType,
    upsert: true,
  });
  if (uploadError) {
    return { ok: false, error: `Upload Storage fallito: ${uploadError.message}` };
  }

  // 4. Cleanup file precedente SOLO se path diverso (upsert su stesso path già sovrascrive)
  if (previousPath && previousPath !== newPath) {
    // Best-effort: se remove fallisce logghiamo warning ma non blocchiamo l'operazione
    const { error: removeError } = await admin.storage.from(BUCKET).remove([previousPath]);
    if (removeError) {
      console.warn(`[m03] Cleanup file precedente fallito (${previousPath}): ${removeError.message}`);
    }
  }

  return {
    ok: true,
    imagePath: newPath,
    costUsd: result.costUsd,
    model: result.model,
    generatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Verifica CI**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 73/73 tests.

- [ ] **Step 5: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/modules/m03-editorial/internal/prompts/image-prompt.md app/src/modules/m03-editorial/internal/image-prompt-composer.ts app/src/modules/m03-editorial/internal/generate-image.ts
git commit -m "RF-4.5 RS-2 RN-72: composer prompt image + template + orchestratore fal.ai + Storage"
git push origin feature/m4-gamma-image-generation
```

---

## Task 7: Server actions + public.ts + published immutable test (2 asserzioni)

**Files:**
- Modify: `app/src/modules/m03-editorial/internal/actions.ts` — +3 server actions
- Modify: `app/src/modules/m03-editorial/public.ts` — export 3 actions
- Create: `app/tests/invariants/content-draft-image-published-immutable.test.ts` — 2 asserzioni

**Interfaces:**
- Consumes: `requireOwnedDraft`, `generateText` (Claude), `getBrandKitWithLists`, `formatBrandContextForAI`, `runGenerateImage`, `setDraftImage`, `clearDraftImage`, `getDraftImagePath`
- Produces:
  - `suggestImagePrompt(draftId): Promise<{ok:true; prompt:string} | {ok:false; error:string}>`
  - `generateContentDraftImage(draftId, prompt, model): Promise<{ok:true} | {ok:false; error:string}>`
  - `deleteContentDraftImage(draftId): Promise<void>`

- [ ] **Step 1: Scrivi test published immutable (TDD RED)**

Create `app/tests/invariants/content-draft-image-published-immutable.test.ts`:

```typescript
// RF-5.7: draft in stato 'published' → immagine immutabile.
// Server action generateContentDraftImage e deleteContentDraftImage devono rifiutare (throw).
import { describe, it, expect, beforeAll, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// Mock del session module per bypassare auth in test
vi.mock("@/lib/auth/session", () => ({
  getSessionOrRedirect: vi.fn(),
}));

import { getSessionOrRedirect } from "@/lib/auth/session";
import {
  generateContentDraftImage,
  deleteContentDraftImage,
} from "@/modules/m03-editorial/public";

describe("Server actions image: draft published immutable (RF-5.7)", () => {
  let draftIdPublished: string;
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — image published immut" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org fallito: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-pub-${orgId.slice(0, 8)}`,
        display_name: "Brand Pub",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data)
      throw new Error(`Setup brand fallito: ${brand.error?.message}`);
    const brandId = (brand.data as { id: string }).id;

    // Fake user_id per session mock
    userId = "00000000-0000-0000-0000-000000000099";

    // Inserisci draft direttamente in stato 'published' con tutti i timestamp
    const approvedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const scheduledAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const publishedAt = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const draft = await admin
      .from("content_drafts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        channel: "social",
        theme_input: "test published immutable",
        generated_text: "testo pubblicato",
        prompt_version: "v1",
        model_used: "m",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        status: "published",
        approved_at: approvedAt.toISOString(),
        scheduled_at: scheduledAt.toISOString(),
        published_at: publishedAt.toISOString(),
        created_by: null,
      })
      .select("id")
      .single();
    if (draft.error || !draft.data)
      throw new Error(`Setup draft published fallito: ${draft.error?.message}`);
    draftIdPublished = (draft.data as { id: string }).id;

    // Mock session per Owner della org
    vi.mocked(getSessionOrRedirect).mockResolvedValue({
      userId,
      organizationId: orgId,
      role: "owner",
    } as never);
  });

  it("generateContentDraftImage su published → error 'non pubblicabile' o simile", async () => {
    const result = await generateContentDraftImage(draftIdPublished, "test prompt", "flux-dev");
    // Ci aspettiamo che rifiuti — o via throw (return {ok:false}) o error propagato
    if (typeof result === "object" && "ok" in result) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.toLowerCase()).toMatch(/pubblicat|immutabile|non modificabile|stato published/);
      }
    }
  });

  it("deleteContentDraftImage su published → throw 'non modificabile'", async () => {
    await expect(deleteContentDraftImage(draftIdPublished)).rejects.toThrow(
      /pubblicat|immutabile|non modificabile|stato published/i,
    );
  });
});
```

- [ ] **Step 2: Esegui test (RED atteso)**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npx dotenv -e .env.local -- npm test -- content-draft-image-published-immutable 2>&1 | tail -15
```
Expected: 2 test FAIL con `generateContentDraftImage is not a function` o simile.

- [ ] **Step 3: Aggiungi import a `actions.ts`**

In `app/src/modules/m03-editorial/internal/actions.ts`, localizza l'import esistente da `./content-drafts-repo` e sostituiscilo con:

```typescript
import {
  markApproved,
  markRejected,
  isRateLimited,
  scheduleDraft,
  unscheduleDraft,
  markPublished,
  setDraftImage,
  clearDraftImage,
  getDraftImagePath,
} from "./content-drafts-repo";
```

Aggiungi anche import per Claude, brand + image gen:

```typescript
import { generateText, AiTimeoutError, AiRateLimitError, AiApiError, AiConfigError } from "@/lib/ai/anthropic";
import { getBrandKitWithLists, formatBrandContextForAI } from "@/modules/m02-brand/public";
import {
  composeImagePromptSystemMessage,
  composeImagePromptUserMessage,
  IMAGE_PROMPT_VERSION,
} from "./image-prompt-composer";
import { runGenerateImage } from "./generate-image";
import type { FluxModel } from "@/lib/ai/fal";
import { createHash } from "crypto";
```

(Alcuni di questi potrebbero essere già presenti da F1.5a — evita duplicati; verifica in cima al file).

- [ ] **Step 4: Aggiungi 3 server actions in fondo a `actions.ts`**

Alla fine di `app/src/modules/m03-editorial/internal/actions.ts` aggiungi:

```typescript
const IMAGE_MUTABLE_STATES = ["draft", "approved", "scheduled"] as const;

function hashPromptShort(prompt: string): string {
  const full = createHash("sha256").update(prompt).digest("hex");
  return `${full.slice(0, 8)}...${full.slice(-8)}`;
}

export async function suggestImagePrompt(
  draftId: string,
): Promise<{ ok: true; prompt: string } | { ok: false; error: string }> {
  const { session, draft } = await requireOwnedDraft(draftId);
  if (!IMAGE_MUTABLE_STATES.includes(draft.status as (typeof IMAGE_MUTABLE_STATES)[number])) {
    return { ok: false, error: `Bozza in stato ${draft.status}, immagine non modificabile.` };
  }

  // Fetch dati draft completi (per generated_text) e brand context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: draftRow } = await admin
    .from("content_drafts")
    .select("generated_text")
    .eq("id", draftId)
    .maybeSingle();
  if (!draftRow) return { ok: false, error: "Bozza non trovata." };

  const bundle = await getBrandKitWithLists(draft.brand_id);
  if (!bundle) return { ok: false, error: "Brand kit non configurato." };
  const brandContext = await formatBrandContextForAI(draft.brand_id);

  const systemPrompt = composeImagePromptSystemMessage();
  const userMessage = composeImagePromptUserMessage({
    brandDisplayName: bundle.brand.display_name,
    brandContext,
    postText: (draftRow as { generated_text: string }).generated_text,
  });

  try {
    const result = await generateText({ systemPrompt, userMessage, maxTokens: 300 });
    return { ok: true, prompt: result.text.trim() };
  } catch (err) {
    if (
      err instanceof AiTimeoutError ||
      err instanceof AiRateLimitError ||
      err instanceof AiApiError ||
      err instanceof AiConfigError
    ) {
      return { ok: false, error: `Impossibile suggerire il prompt: ${(err as Error).message}` };
    }
    throw err;
  }
}

export async function generateContentDraftImage(
  draftId: string,
  prompt: string,
  model: FluxModel = "flux-dev",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = prompt.trim();
  if (trimmed.length < 1 || trimmed.length > 2000) {
    return { ok: false, error: "Prompt non valido (1-2000 caratteri)" };
  }
  if (model !== "flux-dev" && model !== "flux-schnell") {
    return { ok: false, error: "Modello non valido (flux-dev o flux-schnell)" };
  }

  const { session, draft } = await requireOwnedDraft(draftId);
  if (!IMAGE_MUTABLE_STATES.includes(draft.status as (typeof IMAGE_MUTABLE_STATES)[number])) {
    return { ok: false, error: `Bozza in stato ${draft.status}, immagine non modificabile.` };
  }

  const result = await runGenerateImage({
    organizationId: session.organizationId,
    draftId,
    prompt: trimmed,
    model,
  });
  if (!result.ok) return result;

  const updated = await setDraftImage(draftId, session.organizationId, {
    url: result.imagePath,
    prompt: trimmed,
    model: result.model,
    costUsd: result.costUsd,
    generatedAt: result.generatedAt,
  });
  if (!updated) {
    return { ok: false, error: "Bozza modificata da un'altra sessione. Ricarica e riprova." };
  }

  const brandSlug = await getBrandSlug(draft.brand_id);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_image_generated",
    target: `brand:${brandSlug}`,
    details: {
      draftId,
      model: result.model,
      costUsd: result.costUsd,
      promptLength: trimmed.length,
      promptHash: hashPromptShort(trimmed),
      promptVersion: IMAGE_PROMPT_VERSION,
    },
  });

  revalidatePath(`/contenuti/${brandSlug}`);
  revalidatePath(`/contenuti/${brandSlug}/calendario`);
  revalidatePath(`/contenuti/${brandSlug}/${draftId}`);

  return { ok: true };
}

export async function deleteContentDraftImage(draftId: string): Promise<void> {
  const { session, draft } = await requireOwnedDraft(draftId);
  if (!IMAGE_MUTABLE_STATES.includes(draft.status as (typeof IMAGE_MUTABLE_STATES)[number])) {
    throw new Error(`Bozza in stato ${draft.status}, immagine non modificabile.`);
  }

  const imagePath = await getDraftImagePath(draftId, session.organizationId);
  if (!imagePath) return; // no-op

  const brandSlug = await getBrandSlug(draft.brand_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error: removeError } = await admin.storage.from("content-media").remove([imagePath]);
  if (removeError) {
    // Best-effort: log warning ma continua a azzerare DB (per non lasciare orfano)
    console.warn(`[m03] Storage remove fallito: ${removeError.message}`);
  }

  const cleared = await clearDraftImage(draftId, session.organizationId);
  if (!cleared) {
    throw new Error("Impossibile azzerare i campi immagine del draft.");
  }

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_image_deleted",
    target: `brand:${brandSlug}`,
    details: { draftId, deletedPath: imagePath },
  });

  revalidatePath(`/contenuti/${brandSlug}`);
  revalidatePath(`/contenuti/${brandSlug}/calendario`);
  revalidatePath(`/contenuti/${brandSlug}/${draftId}`);
}
```

- [ ] **Step 5: Estendi export in `public.ts`**

Modify `app/src/modules/m03-editorial/public.ts`. Localizza il blocco `export { ... } from "./internal/actions"` e sostituiscilo con:

```typescript
// Server actions (form submit)
export {
  generateSocialPost,
  approveContentDraft,
  rejectContentDraft,
  scheduleContentDraft,
  unscheduleContentDraft,
  markContentDraftPublished,
  suggestImagePrompt,
  generateContentDraftImage,
  deleteContentDraftImage,
} from "./internal/actions";
```

- [ ] **Step 6: Riesegui test published immutable (GREEN)**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npx dotenv -e .env.local -- npm test -- content-draft-image-published-immutable 2>&1 | tail -10
```
Expected: 2/2 passing.

- [ ] **Step 7: Verifica CI completa**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, `Tests 75 passed (75)` (era 73, +2).

- [ ] **Step 8: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/modules/m03-editorial/internal/actions.ts app/src/modules/m03-editorial/public.ts app/tests/invariants/content-draft-image-published-immutable.test.ts
git commit -m "RF-4.5 RA-8.5 RA-8.12 RF-11.3 RF-5.7: 3 server actions image + published immutable test"
git push origin feature/m4-gamma-image-generation
```

---

## Task 8: Image section client + [draftId]/page.tsx integration

**Files:**
- Create: `app/src/app/(protected)/contenuti/[slug]/[draftId]/image-section.tsx`
- Modify: `app/src/app/(protected)/contenuti/[slug]/[draftId]/page.tsx`

**Interfaces:**
- Consumes: `suggestImagePrompt`, `generateContentDraftImage`, `deleteContentDraftImage` da m03/public
- Produces: sezione UI "Immagine del post" nel dettaglio draft con 5 stati (vuoto, prompt suggerito, generazione in corso, immagine presente, modifica prompt)

- [ ] **Step 1: Crea `image-section.tsx` client component**

Create `app/src/app/(protected)/contenuti/[slug]/[draftId]/image-section.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, Edit3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  suggestImagePrompt,
  generateContentDraftImage,
  deleteContentDraftImage,
} from "@/modules/m03-editorial/public";
import type { ContentDraftStatus } from "@/modules/m03-editorial/public";

type Props = {
  draftId: string;
  status: ContentDraftStatus;
  currentImageSignedUrl: string | null;
  currentImagePrompt: string | null;
  currentImageModel: string | null;
  currentImageCost: number | null;
  currentImageGeneratedAt: string | null;
};

type FluxModel = "flux-dev" | "flux-schnell";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ImageSection(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>(props.currentImagePrompt ?? "");
  const [model, setModel] = useState<FluxModel>(
    (props.currentImageModel as FluxModel | null) ?? "flux-dev",
  );
  const [showPromptForm, setShowPromptForm] = useState<boolean>(false);
  const [editingPrompt, setEditingPrompt] = useState<boolean>(false);

  const isReadonly = props.status === "published" || props.status === "rejected";
  const hasImage = props.currentImageSignedUrl !== null;

  async function handleSuggest() {
    setError(null);
    startTransition(async () => {
      const res = await suggestImagePrompt(props.draftId);
      if (res.ok) {
        setPrompt(res.prompt);
        setShowPromptForm(true);
      } else {
        setError(res.error);
      }
    });
  }

  async function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await generateContentDraftImage(props.draftId, prompt, model);
      if (res.ok) {
        setShowPromptForm(false);
        setEditingPrompt(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  async function handleDelete() {
    if (!confirm("Confermi? L'immagine sarà cancellata.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteContentDraftImage(props.draftId);
        setPrompt("");
        setShowPromptForm(false);
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <header className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold text-text">Immagine del post</h3>
        {props.currentImageModel && (
          <div className="flex flex-wrap gap-1 text-xs">
            <Badge variant="outline">Modello: {props.currentImageModel}</Badge>
            {props.currentImageCost !== null && (
              <Badge variant="outline">Costo: ${props.currentImageCost.toFixed(4)}</Badge>
            )}
            {props.currentImageGeneratedAt && (
              <Badge variant="outline">Generata: {formatDateTime(props.currentImageGeneratedAt)}</Badge>
            )}
          </div>
        )}
      </header>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Stato: immagine presente */}
      {hasImage && (
        <div className="space-y-2">
          <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-md border border-border">
            {props.currentImageSignedUrl && (
              <Image
                src={props.currentImageSignedUrl}
                alt="Immagine del post"
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 400px"
              />
            )}
          </div>

          {!editingPrompt && (
            <div className="rounded-md border border-border bg-surface-muted p-2">
              <div className="mb-1 text-xs font-medium text-text-muted">Prompt usato</div>
              <div className="whitespace-pre-wrap text-xs text-text">{props.currentImagePrompt}</div>
            </div>
          )}

          {editingPrompt && (
            <div className="space-y-2">
              <Label htmlFor="prompt-edit">Nuovo prompt</Label>
              <Textarea
                id="prompt-edit"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                maxLength={2000}
                disabled={pending}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="model-edit">Modello</Label>
                <Select value={model} onValueChange={(v) => setModel(v as FluxModel)}>
                  <SelectTrigger id="model-edit" disabled={pending}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flux-dev">FLUX dev (qualità piena, ~10s)</SelectItem>
                    <SelectItem value="flux-schnell">FLUX schnell (veloce, ~2s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={pending || prompt.trim().length === 0}
                  className="bg-primary text-white hover:bg-primary-hover"
                >
                  {pending ? "Generando…" : "Genera con nuovo prompt"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingPrompt(false);
                    setPrompt(props.currentImagePrompt ?? "");
                  }}
                  disabled={pending}
                >
                  Annulla
                </Button>
              </div>
            </div>
          )}

          {!editingPrompt && !isReadonly && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={handleGenerate}
                disabled={pending}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Rigenera stesso prompt
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingPrompt(true)}
                disabled={pending}
              >
                <Edit3 className="mr-2 h-4 w-4" /> Modifica prompt
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                disabled={pending}
                className="border-danger/40 text-danger hover:bg-danger/10"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Elimina
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Stato: vuoto + mutable */}
      {!hasImage && !isReadonly && !showPromptForm && (
        <Button
          onClick={handleSuggest}
          disabled={pending}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {pending ? "Claude sta pensando…" : "Suggerisci prompt immagine"}
        </Button>
      )}

      {/* Stato: prompt suggerito (form) */}
      {!hasImage && !isReadonly && showPromptForm && (
        <div className="space-y-2">
          <Label htmlFor="prompt-new">Prompt (modificabile prima di generare)</Label>
          <Textarea
            id="prompt-new"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="warm cozy interior at dusk, terracotta tones..."
            disabled={pending}
          />
          <p className="text-xs text-text-muted">
            Il prompt è in inglese per compatibilità con FLUX. Puoi modificarlo o cliccare
            &quot;Suggerisci di nuovo&quot;.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model-new">Modello</Label>
            <Select value={model} onValueChange={(v) => setModel(v as FluxModel)}>
              <SelectTrigger id="model-new" disabled={pending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flux-dev">FLUX dev (qualità piena, ~10s)</SelectItem>
                <SelectItem value="flux-schnell">FLUX schnell (veloce, ~2s)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleGenerate}
              disabled={pending || prompt.trim().length === 0}
              className="bg-primary text-white hover:bg-primary-hover"
            >
              {pending ? "Generando immagine… (5-15s)" : "Genera immagine"}
            </Button>
            <Button variant="outline" onClick={handleSuggest} disabled={pending}>
              <Sparkles className="mr-2 h-4 w-4" /> Suggerisci di nuovo
            </Button>
          </div>
        </div>
      )}

      {/* Stato: readonly senza immagine */}
      {!hasImage && isReadonly && (
        <p className="text-sm text-text-muted">
          Nessuna immagine associata a questa bozza (stato {props.status}, non modificabile).
        </p>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Aggiorna `[draftId]/page.tsx`**

Modify `app/src/app/(protected)/contenuti/[slug]/[draftId]/page.tsx`.

Aggiungi import:

```tsx
import { ImageSection } from "./image-section";
```

Nella funzione RSC `DraftDetailPage`, dopo aver ottenuto `draft` (da `getContentDraft`), aggiungi:

```tsx
  // Signed URL per immagine se presente
  let imageSignedUrl: string | null = null;
  if (draft.imageUrl) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adminForStorage = getAdminClient() as any;
    const { data: signedData } = await adminForStorage.storage
      .from("content-media")
      .createSignedUrl(draft.imageUrl, 3600);
    imageSignedUrl = (signedData as { signedUrl: string } | null)?.signedUrl ?? null;
  }
```

Poi nel JSX ritornato, dopo il blocco `{draft.status === "rejected" ...}` finale (in fondo alle sezioni azione condizionali), aggiungi:

```tsx
      <ImageSection
        draftId={draft.id}
        status={draft.status}
        currentImageSignedUrl={imageSignedUrl}
        currentImagePrompt={draft.imagePrompt}
        currentImageModel={draft.imageModel}
        currentImageCost={draft.imageCostUsd}
        currentImageGeneratedAt={draft.imageGeneratedAt}
      />
```

- [ ] **Step 3: Verifica CI**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 75/75 tests.

Se emerge violazione RS-1 boundaries: verifica che `image-section.tsx` importi SOLO da `@/modules/m03-editorial/public`, mai da `internal`.

- [ ] **Step 4: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/app/\(protected\)/contenuti/\[slug\]/\[draftId\]/
git commit -m "RF-4.5 RU-1a: image-section client + dettaglio draft con signed URL"
git push origin feature/m4-gamma-image-generation
```

---

## Task 9: Thumbnail component + lista + calendario integration

**Files:**
- Create: `app/src/components/media/image-thumbnail.tsx`
- Modify: `app/src/app/(protected)/contenuti/[slug]/page.tsx`
- Modify: `app/src/app/(protected)/contenuti/[slug]/calendario/page.tsx`
- Modify: `app/src/app/(protected)/contenuti/[slug]/calendario/calendar-client.tsx`
- Modify: `app/src/app/(protected)/contenuti/[slug]/calendario/biweekly-grid.tsx`
- Modify: `app/src/app/(protected)/contenuti/[slug]/calendario/droppable-cell.tsx`

**Interfaces:**
- Consumes: signed URL Supabase Storage
- Produces: thumbnail rendering nella tabella lista drafts e nelle card calendario

- [ ] **Step 1: Crea `image-thumbnail.tsx` (RSC async helper)**

Create `app/src/components/media/image-thumbnail.tsx`:

```tsx
import Image from "next/image";
import { getAdminClient } from "@/lib/db/admin";

type Props = {
  imagePath: string | null;
  size?: number;
  alt?: string;
};

export async function ImageThumbnail({ imagePath, size = 40, alt = "Anteprima" }: Props) {
  if (!imagePath) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data } = await admin.storage.from("content-media").createSignedUrl(imagePath, 3600);
  const signedUrl = (data as { signedUrl: string } | null)?.signedUrl;
  if (!signedUrl) return null;

  return (
    <div
      className="relative overflow-hidden rounded border border-border"
      style={{ width: size, height: size }}
    >
      <Image src={signedUrl} alt={alt} fill className="object-cover" sizes={`${size}px`} />
    </div>
  );
}
```

- [ ] **Step 2: Integra thumbnail in `[slug]/page.tsx` (lista drafts)**

Modify `app/src/app/(protected)/contenuti/[slug]/page.tsx`.

Aggiungi import:

```tsx
import { ImageThumbnail } from "@/components/media/image-thumbnail";
```

Nella tabella drafts, in `<TableRow>` prima cella (o accanto al themeInput), aggiungi:

```tsx
                <TableCell className="w-12">
                  {/* @ts-expect-error Async Server Component */}
                  <ImageThumbnail imagePath={d.imageUrl} size={40} alt={d.themeInput.slice(0, 30)} />
                </TableCell>
```

Aggiungi anche header per la nuova colonna:

```tsx
              <TableHead className="w-12"></TableHead>
              {/* ...altri TableHead esistenti... */}
```

- [ ] **Step 3: Integra pre-signed URLs nel calendario RSC**

Modify `app/src/app/(protected)/contenuti/[slug]/calendario/page.tsx`.

Dopo il Promise.all esistente per `scheduled` + `approved`, aggiungi generazione parallela di signed URLs:

```tsx
  // Pre-genera signed URLs per tutti i drafts scheduled con immagine
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminStorage = admin as any;
  const scheduledWithSignedUrls = await Promise.all(
    scheduled.map(async (d) => {
      if (!d.imageUrl) return { ...d, imageSignedUrl: null as string | null };
      const { data } = await adminStorage.storage
        .from("content-media")
        .createSignedUrl(d.imageUrl, 3600);
      return {
        ...d,
        imageSignedUrl: (data as { signedUrl: string } | null)?.signedUrl ?? null,
      };
    }),
  );
```

Passa `scheduledWithSignedUrls` invece di `scheduled` a `<CalendarClient>`:

```tsx
      <CalendarClient
        brandSlug={slug}
        startDateIso={startDate.toISOString()}
        scheduled={scheduledWithSignedUrls}
        approved={approved}
      />
```

- [ ] **Step 4: Estendi type in `calendar-client.tsx`**

Modify `app/src/app/(protected)/contenuti/[slug]/calendario/calendar-client.tsx`.

Aggiungi in cima al file (dopo gli import esistenti):

```tsx
import type { ContentDraft } from "@/modules/m03-editorial/public";

export type ScheduledDraftWithUrl = ContentDraft & { imageSignedUrl: string | null };
```

Modifica il type `Props`:

```tsx
type Props = {
  brandSlug: string;
  startDateIso: string;
  scheduled: ScheduledDraftWithUrl[];  // era ContentDraft[]
  approved: ContentDraft[];
};
```

Passa la nuova tipologia a `<BiweeklyGrid>`:

```tsx
<BiweeklyGrid startDateIso={startDateIso} scheduled={scheduled} brandSlug={brandSlug} />
```

- [ ] **Step 5: Passa il type esteso in `biweekly-grid.tsx`**

Modify `app/src/app/(protected)/contenuti/[slug]/calendario/biweekly-grid.tsx`.

Aggiungi import:

```tsx
import type { ScheduledDraftWithUrl } from "./calendar-client";
```

Modifica il type `Props`:

```tsx
type Props = {
  startDateIso: string;
  scheduled: ScheduledDraftWithUrl[];  // era ContentDraft[]
  brandSlug: string;
};
```

Anche la prop `drafts` di `DroppableCell` diventa `ScheduledDraftWithUrl[]` — passala così:

```tsx
        <DroppableCell
          key={dateYmd}
          date={date}
          dateYmd={dateYmd}
          drafts={draftsInDay}
          isPast={isPast}
          brandSlug={brandSlug}
        />
```

- [ ] **Step 6: Aggiungi thumbnail in `droppable-cell.tsx`**

Modify `app/src/app/(protected)/contenuti/[slug]/calendario/droppable-cell.tsx`.

Aggiungi import in cima:

```tsx
import Image from "next/image";
import type { ScheduledDraftWithUrl } from "./calendar-client";
```

Modifica il type `Props`:

```tsx
type Props = {
  date: Date;
  dateYmd: string;
  drafts: ScheduledDraftWithUrl[];  // era ContentDraft[]
  isPast: boolean;
  brandSlug: string;
};
```

Nel rendering della card draft (dentro `{drafts.map((d) => (` ...), aggiungi il thumbnail sopra il badge/tema (mostra solo se signed URL presente):

```tsx
        <Link
          key={d.id}
          href={`/contenuti/${brandSlug}/${d.id}`}
          className="block rounded border border-border/60 bg-surface-muted/60 p-1.5 hover:border-primary/60"
        >
          {d.imageSignedUrl && (
            <div className="relative mb-1 h-16 w-full overflow-hidden rounded">
              <Image
                src={d.imageSignedUrl}
                alt="Anteprima post"
                fill
                className="object-cover"
                sizes="200px"
              />
            </div>
          )}
          <div className="mb-0.5 flex items-center justify-between gap-1">
            {/* ...badge + ora esistenti... */}
          </div>
          <div className="text-[11px] font-medium leading-tight text-text">
            {truncate(d.themeInput, 60)}
          </div>
        </Link>
```

- [ ] **Step 7: Verifica CI**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 75/75 tests. Se emerge warning `@ts-expect-error` non necessario: rimuovi la direttiva.

- [ ] **Step 8: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/components/media/image-thumbnail.tsx app/src/app/\(protected\)/contenuti/\[slug\]/page.tsx app/src/app/\(protected\)/contenuti/\[slug\]/calendario/
git commit -m "RF-4.5: thumbnail immagine in lista drafts + card calendario con pre-signed URLs"
git push origin feature/m4-gamma-image-generation
```

---

## Task 10: Impostazioni card FAL_API_KEY

**Files:**
- Modify: `app/src/app/(protected)/impostazioni/page.tsx`

**Interfaces:**
- Consumes: `process.env["FAL_API_KEY"]`, helper `maskApiKey` esistente
- Produces: terza riga nella card "Chiavi AI" per FAL_API_KEY

- [ ] **Step 1: Aggiungi lettura env in RSC**

Modify `app/src/app/(protected)/impostazioni/page.tsx`.

Localizza le righe che leggono `anthropic` e `voyage` (con `maskApiKey`) e aggiungi sotto:

```tsx
  const fal = maskApiKey(process.env["FAL_API_KEY"]);
```

- [ ] **Step 2: Aggiungi riga UI nella card "Chiavi AI"**

Nella sezione card "Chiavi AI", dopo il div Voyage, aggiungi:

```tsx
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              fal.ai (FLUX, immagini AI)
            </span>
            {fal.present ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-success">✅ configurata</span>
                <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
                  {fal.masked}
                </code>
              </div>
            ) : (
              <span className="text-sm text-danger">
                ❌ non configurata (M4-γ non funzionerà senza)
              </span>
            )}
          </div>
```

- [ ] **Step 3: Verifica CI**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 75/75.

- [ ] **Step 4: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/app/\(protected\)/impostazioni/page.tsx
git commit -m "RNF-1: card 'Chiavi AI' estesa con FAL_API_KEY status (M4-gamma)"
git push origin feature/m4-gamma-image-generation
```

---

## Task 11: Verifica finale + diario + push chiusura

**Files:**
- Modify: `docs/diario.md`

**Interfaces:**
- Consumes: risultati T0–T10
- Produces: diario aggiornato, cantiere chiuso pronto per merge

- [ ] **Step 1: Ricrea Owner locale**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
bash scripts/dev-create-owner.sh
```
Expected: `==> Utente Owner dev pronto.`

- [ ] **Step 2: Verifica CI finale**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, `Test Files 27 passed (27)` (era 22, +5), `Tests 75 passed (75)`.

- [ ] **Step 3: Sanity smoke test manuale (facoltativo — richiede FAL_API_KEY)**

Se hai configurato `FAL_API_KEY` in `.env.local`, avvia dev server e testa:
1. Login `admin@admin.com` / `admin123`
2. `/contenuti/lenny/{draftId}` di un draft approved
3. Verifica sezione "Immagine del post" con bottone "Suggerisci prompt immagine"
4. Click → attendi Claude → textarea popolata
5. Click "Genera immagine" → attendi 5-10s → immagine appare
6. Torna a `/contenuti/lenny` → thumbnail accanto al tema
7. `/impostazioni` → card "Chiavi AI" mostra FAL_API_KEY ✅
8. `/audit` → voci `editorial.draft_image_generated`

Se scopri bug: fix round PRIMA di diario.

- [ ] **Step 4: Aggiorna `docs/diario.md`**

Sostituisci "## Adesso" con:

```markdown
## Adesso

- M4-γ chiuso su `feature/m4-gamma-image-generation`, pronto per merge in
  `feature/f1-1-layout-shell`. Generazione immagini AI (fal.ai + FLUX)
  integrata nel dettaglio draft esistente: bottone "Suggerisci prompt" →
  Claude compone prompt inglese contestualizzato → Owner conferma/modifica →
  fal.ai genera → Supabase Storage privato con RLS per org. Thumbnail in
  lista + calendario. Prossima decisione: (a) M4-α libreria foto reali,
  (b) M4-ε multi-aspect ratio (Story 9:16, feed 4:5), (c) F1.5b-β coda
  BullMQ, (d) F1.6 edit chiavi + tetti spesa, (e) F1.3 utenti Editor,
  (f) M5 publishing con adapter canali reali.
```

Aggiungi in cima a "## Fatto":

```markdown
- **18 set 2026 (ore serali) — M4-γ Generazione immagini AI (fal.ai FLUX) completato.**
  - Adapter `lib/ai/fal.ts` (RS-2 unica porta): FLUX-dev (qualità piena, ~10s, $0.025/img)
    e FLUX-schnell (veloce, ~2s, $0.003/img), timeout 30s con AbortController, error
    classes tipizzate, pricing hardcoded (RS-5 nota: aggiornare annualmente).
  - Nuovo bucket Supabase Storage `content-media` privato con 4 RLS policy org-scoped
    (SELECT/INSERT/UPDATE/DELETE), file limit 5MB, MIME whitelist image/jpeg|png|webp.
  - 5 nuove colonne su `content_drafts` (image_url, image_prompt, image_model,
    image_cost_usd, image_generated_at) + 4 CHECK individuali (length, enum, non-negative)
    + 1 CHECK all-or-nothing (RS-3): impedisce stati parziali dei 5 campi image_*.
  - Composer prompt in `internal/image-prompt-composer.ts` (funzione pura) + template
    `prompts/image-prompt.md` versionato (`image-prompt-v1`) + orchestratore
    `generate-image.ts` che chiama fal.ai + upload Supabase Storage + cleanup file
    precedente.
  - 3 nuove server actions m03: `suggestImagePrompt` (chiama Claude, no audit),
    `generateContentDraftImage` (chiama orchestratore + audit + revalidate),
    `deleteContentDraftImage` (Storage remove + azzera colonne + audit). Race guard
    tenant scoping pattern IDOR ripetuto per la quinta volta.
  - UI dettaglio draft: nuova sezione "Immagine del post" (`image-section.tsx` client,
    5 stati: vuoto/prompt-suggerito/generazione/immagine-presente/modifica-prompt).
    Thumbnail `<ImageThumbnail>` (RSC async con signed URL 1h) su lista drafts.
    Calendario refactored per pre-generare signed URLs nella RSC parent e passarle
    lungo la chain CalendarClient → BiweeklyGrid → DroppableCell (nuovo type
    `ScheduledDraftWithUrl`). Card "Chiavi AI" in `/impostazioni` estesa con status
    FAL_API_KEY.
  - Vincoli capitolato rispettati: RF-5.7 draft published→immagine immutabile
    (server action status guard); RNF-9 fallback graceful se fal.ai down/config
    missing/timeout (return {ok:false} no partial state); RN-72 system prompt
    Claude include "NON inventare dati concreti"; RA-8.12 audit
    `editorial.draft_image_generated|deleted` con promptHash SHA-256 (non prompt full).
  - 13 nuovi test in 5 file (3 all-or-nothing + 4 column CHECK + 2 Storage RLS +
    2 tenant scoping IDOR + 2 published immutable). Totale test dopo M4-γ: **75**
    (era 62). CI locale verde 75/75.
  - Costo stimato mensile: ~$2.30 (150 img/mese × $0.025 FLUX-dev + Claude suggest
    ~$0.05). Budget V-4 non impattato.
  - Commit range: `5f4706e..HEAD` (~10 commit) su `feature/m4-gamma-image-generation`.
  - Prossimo sotto-cantiere: M4-α (libreria foto reali RF-4.1) o M4-ε (multi-aspect
    ratio RF-4.6) o altri cantieri fuori M4.
```

Aggiungi in "## Da non dimenticare":

```markdown
- **Rotare la chiave FAL_API_KEY** dopo aver finito il tour manuale M4-γ (se è finita
  nel transcript Claude Code): dashboard fal.ai → API Keys → rigenera → sostituire
  in `app/.env.local`. Nessuna urgenza operativa.
- **Verificare annualmente il pricing fal.ai** su https://fal.ai/pricing e aggiornare
  `PRICE_PER_IMAGE_USD` in `lib/ai/fal.ts` se cambia significativamente.
```

Aggiorna data in cima: `> Aggiornato: 18 settembre 2026`.

- [ ] **Step 5: Verifica CI finale**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: 75/75.

- [ ] **Step 6: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add docs/diario.md
git commit -m "RQ-7: chiusura M4-gamma image generation, aggiornamento diario"
git push origin feature/m4-gamma-image-generation
```

- [ ] **Step 7: Verifica GitHub Actions**

```bash
gh run list --branch feature/m4-gamma-image-generation --limit 3
```
Expected: ultimo run `completed` con `conclusion: success`.

---

## Autoverifica del piano

### Copertura spec

| Spec sezione | Task |
|---|---|
| §1 Obiettivo + deliverable 12-step | T11 (tour manuale) + tutti i T precedenti |
| §2 Global constraints (15 vincoli) | Tutti i task (richiamati in ogni testata) |
| §3 Architettura moduli | T4–T10 (estende m03, no modulo M4 nuovo, adapter lib/ai/fal, componenti UI) |
| §4.1 5 colonne image_* | T2 (migration) + T3 (types + rowToDraft) |
| §4.2 5 CHECK constraint | T2 (migration + test 3+4=7 asserzioni sui CHECK) |
| §4.3 Bucket content-media privato | T2 (migration INSERT storage.buckets) |
| §4.4 RLS storage.objects (4 policy) | T2 (migration CREATE POLICY × 4 + test Storage RLS 2 asserzioni) |
| §4.5 Migrazione unico file | T2 (`20260918000004_content_drafts_image_columns.sql`) |
| §4.6 RLS content_drafts inherited | Nessuna azione richiesta (F1.5a già denial-by-default) |
| §4.7 Storicizzazione audit | T7 (audit action `editorial.draft_image_generated|deleted`) |
| §5.1–5.6 Adapter fal.ai | T5 |
| §6.1 Composer puro | T6 (`image-prompt-composer.ts`) |
| §6.2 Template Claude | T6 (`prompts/image-prompt.md`) |
| §6.3 Orchestratore | T6 (`generate-image.ts`) |
| §6.4 3 Server actions | T7 |
| §6.5 3 Repo functions | T4 |
| §6.6 public.ts exports | T7 |
| §7.1 image-section.tsx client | T8 |
| §7.2 [draftId]/page.tsx integration | T8 |
| §7.3 image-thumbnail.tsx | T9 (Step 1) |
| §7.4 [slug]/page.tsx thumbnail | T9 (Step 2) |
| §7.5 calendario refactor pre-signed URLs | T9 (Step 3-6) |
| §7.6 impostazioni card FAL_API_KEY | T10 |
| §8 Test invarianti (5 file, 13 asserzioni) | T2 (9) + T4 (2) + T7 (2) |
| §9 DoD | T11 (CI + tour + diario) |
| §10 Out-of-scope | Task NON creati (garanzia YAGNI) |

### Placeholder scan

Nessun "TBD", "TODO", "implementa dopo", "simile a task N". Ogni step ha codice concreto e comandi eseguibili.

### Type consistency

- `ContentDraftStatus` esteso in F1.5b-α con 5 stati — usato in T7 (server actions guard `IMAGE_MUTABLE_STATES`) e T8 (`ImageSection` props `status`)
- `ContentDraft` esteso con 5 campi image_* (camelCase) in T3 — usato in T4 (repo return), T8 (props ImageSection), T9 (thumbnail)
- `FluxModel = "flux-dev" | "flux-schnell"` type esportato da lib/ai/fal.ts in T5 — usato in T6 (orchestratore input) e T7 (server action param)
- `setDraftImage`/`clearDraftImage`/`getDraftImagePath` signatures in T4 — usati in T6 (getDraftImagePath) e T7 (tutti e 3)
- `suggestImagePrompt`/`generateContentDraftImage`/`deleteContentDraftImage` in T7 — usati in T8 (import da public.ts)
- `IMAGE_PROMPT_VERSION` in T6 — usato in T7 (audit details)
- `ScheduledDraftWithUrl` type in T9 — usato in calendar-client + biweekly-grid + droppable-cell
- `IMAGE_MUTABLE_STATES` in T7 — const array esportata implicita, coerente in tutti e 3 gli status guard
- `runGenerateImage` in T6 — usato in T7 (server action)
- `composeImagePromptSystemMessage` + `composeImagePromptUserMessage` in T6 — usati in T7 (suggestImagePrompt)
- `hashPromptShort` in T7 — helper interno all'action, non esportato
- `getBrandSlug` esistente da F1.5a — usato in T7 (nuove actions)
- `logAuditEvent` esistente — usato in T7 (nuove actions)
- `revalidatePath` esistente — usato in T7 (nuove actions)
- Bucket name `content-media` — coerente in T2 (migration), T6 (upload), T7 (delete), T8 (signed URL), T9 (thumbnail signed URL)

Nessuna incongruenza rilevata.

---

## Consegna esecuzione

Piano salvato in `docs/superpowers/plans/2026-09-18-m4-gamma-image-generation.md`.

Ogni task chiude con `git push origin feature/m4-gamma-image-generation`. GitHub Actions CI trigga su ogni push, feedback verde/rosso in ~4-5 min.

**Numero task:** 12 (T0 setup + T1 env config + T2 migration + tests DB/Storage + T3 types + T4 repo functions + T5 adapter fal.ai + T6 composer + template + orchestratore + T7 server actions + published immutable test + T8 UI image-section + T9 thumbnail integration + T10 impostazioni + T11 chiusura).

**Test totali attesi a fine cantiere:** 75 (62 preesistenti + 13 nuovi: 3 all-or-nothing + 4 column CHECK + 2 Storage RLS + 2 tenant scoping IDOR + 2 published immutable).

**Baseline HEAD:** `5f4706e` su `feature/f1-1-layout-shell`.

**Dipendenza esterna nuova:** `FAL_API_KEY` da https://fal.ai (free tier $10 iniziali). Owner deve iscriversi prima di T2 (dev-side test invarianti Storage RLS non richiedono la chiave — usano l'anon key) e prima del tour manuale T11 (richiede chiave vera).
