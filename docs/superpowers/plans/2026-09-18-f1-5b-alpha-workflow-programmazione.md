# F1.5b-α Implementation Plan — Workflow + calendario editoriale + programmazione manuale

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estendere `m03-editorial` con state machine `scheduled`/`published`, calendario bisettimanale con drag-and-drop dei contenuti approvati e programmazione manuale, e aggiungere card "Chiavi AI" read-only su `/impostazioni`.

**Architecture:** Estensione minimale di `content_drafts` (2 colonne + enum extension), zero nuove tabelle. UI calendario con `@dnd-kit/core` in griglia CSS 2×7 responsive. Impostazioni card server-side legge `process.env` e maschera parzialmente. Nessuna coda, nessun publish adapter, nessun servizio esterno nuovo (Redis, BullMQ, Upstash sono F1.5b-β).

**Tech Stack:** Next.js 16 App Router + React 19 Server Actions, Supabase Postgres, TypeScript strict, Tailwind + shadcn/ui, `@dnd-kit/core` + `@dnd-kit/utilities`, vitest per test invarianti.

**Spec:** `docs/superpowers/specs/2026-09-17-f1-5b-alpha-workflow-programmazione-design.md`

## Global Constraints

- **RQ-1** Ogni commit inizia con gli ID capitolato: `<IDs>: <descrizione italiano>`.
- **RQ-7** Ogni task chiude con `cd app && npm run ci` verde (lint + format + typecheck + boundaries + migrazioni + 55→62 test) e `git push origin feature/f1-5b-alpha-workflow-programmazione`.
- **RS-1** Boundaries verificati da dep-cruiser. UI in `(protected)/contenuti/[slug]/calendario/*` importa da `@/modules/m03-editorial/public`, mai da internal. Test `m03-editorial-boundaries.test.ts` esistente cattura violazioni.
- **RS-2** Nessun SDK esterno introdotto. `@dnd-kit` sono UI libraries, non fornitori di servizi.
- **RS-3** 3 nuovi CHECK constraint DB: `schedule_has_timestamp`, `publish_has_timestamp`, `schedule_after_approve`.
- **RS-6** Server Actions React 19 con `"use server"`, `next/navigation` per `notFound`/`redirect`, `@dnd-kit` con `DndContext` + `useDraggable` + `useDroppable`.
- **RS-8** Migrazioni versionate `YYYYMMDDNNNNNN_verbo_soggetto.sql`, 14 cifre continue. Data corrente = 2026-09-18 → prefissi `20260918000001` e `20260918000002`.
- **RN-87** Tutte le repo function accettano `organizationId` con `.eq("organization_id", organizationId)`. Server actions usano `requireOwnedDraft` esistente.
- **RU-1a** F1.5b-α resta solo Owner: ogni page RSC chiama `notFound()` se `session.role !== "owner"`.
- **RA-8.5** Server actions come strumenti tipizzati, autorizzazione applicata dal codice.
- **RA-8.12** Audit obbligatorio per ogni transizione: `editorial.draft_scheduled`, `editorial.draft_unscheduled`, `editorial.draft_published`.
- **RF-11.3** `logAuditEvent` per ogni action con `target: brand:<slug>` e `details` che include `draftId` + timestamp/data.
- **RNF-1** Nessun segreto nel repo. La card "Chiavi AI" (§6.9 spec) mostra solo maschera parziale, calcolata server-side. Le key vive restano in `.env.local` ignorato.

**Lingua:** identificatori codice inglese; UI/commenti/docs/messaggi errore italiano.

**Baseline:** branch `feature/f1-1-layout-shell` HEAD `2b4b508` — F1.5a mergiato + hotfix RNF-9. Test totali baseline: **55**. Target fine cantiere: **62**.

**Branch cantiere:** `feature/f1-5b-alpha-workflow-programmazione` da `feature/f1-1-layout-shell`.

---

## File Structure

**Migrazioni DB (nuove):**
- `app/supabase/migrations/20260918000001_content_drafts_status_scheduled_published.sql` — enum extension
- `app/supabase/migrations/20260918000002_content_drafts_scheduling_columns.sql` — 2 colonne + 3 CHECK + 1 index

**Modulo `m03-editorial` (modifiche):**
- `app/src/modules/m03-editorial/internal/content-drafts-types.ts` — estende `ContentDraftStatus`, aggiunge `scheduledAt`/`publishedAt` a `ContentDraft`
- `app/src/modules/m03-editorial/internal/content-drafts-repo.ts` — +5 funzioni (`scheduleDraft`, `unscheduleDraft`, `markPublished`, `listScheduledByBrandBetween`, `listApprovedNotScheduledByBrand`) + update `rowToDraft` + `SELECT_COLS`
- `app/src/modules/m03-editorial/internal/actions.ts` — +3 server actions (`scheduleContentDraft`, `unscheduleContentDraft`, `markContentDraftPublished`)
- `app/src/modules/m03-editorial/public.ts` — esporta le 3 actions + 2 query

**UI route (nuove):**
- `app/src/app/(protected)/contenuti/[slug]/calendario/page.tsx` — RSC vista bisettimanale
- `app/src/app/(protected)/contenuti/[slug]/calendario/calendar-client.tsx` — client `DndContext` wrapper
- `app/src/app/(protected)/contenuti/[slug]/calendario/biweekly-grid.tsx` — client, griglia 2×7
- `app/src/app/(protected)/contenuti/[slug]/calendario/droppable-cell.tsx` — client cella
- `app/src/app/(protected)/contenuti/[slug]/calendario/draggable-card.tsx` — client card
- `app/src/app/(protected)/contenuti/[slug]/calendario/approved-drawer.tsx` — client drawer
- `app/src/app/(protected)/contenuti/[slug]/calendario/loading.tsx` — skeleton
- `app/src/app/(protected)/contenuti/[slug]/calendario/error.tsx` — boundary

**UI route (modifiche):**
- `app/src/app/(protected)/contenuti/[slug]/page.tsx` — StatusBadge esteso + link "Calendario"
- `app/src/app/(protected)/contenuti/[slug]/[draftId]/page.tsx` — sezione azioni riscritta con branching status
- `app/src/app/(protected)/contenuti/[slug]/[draftId]/schedule-form.tsx` — NEW client component
- `app/src/app/(protected)/impostazioni/page.tsx` — aggiunge card "Chiavi AI"

**Test (nuovi):**
- `app/tests/invariants/content-draft-status-enum-extended.test.ts` — 2 asserzioni
- `app/tests/invariants/content-draft-schedule-invariants.test.ts` — 3 asserzioni
- `app/tests/invariants/content-drafts-scheduled-tenant-scoping.test.ts` — 2 asserzioni

**Documentazione:**
- `docs/diario.md` — aggiornato in T11

---

## Task 0: Setup branch

**Files:**
- Nessuno (setup)

**Interfaces:**
- Consumes: `feature/f1-1-layout-shell` HEAD `2b4b508`
- Produces: nuovo branch `feature/f1-5b-alpha-workflow-programmazione` locale + remote

- [ ] **Step 1: Verifica baseline sul branch corrente**

Run: 
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git status
git log --oneline -3
```
Expected: working tree pulito, branch = `feature/f1-1-layout-shell`, HEAD = `2b4b508`.

- [ ] **Step 2: Verifica CI baseline verde 55/55**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, `Test Files 19 passed (19)`, `Tests 55 passed (55)`.

Se fallisce: NON creare branch. Riportare il problema.

- [ ] **Step 3: Crea nuovo branch dal HEAD attuale**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git checkout -b feature/f1-5b-alpha-workflow-programmazione
git push -u origin feature/f1-5b-alpha-workflow-programmazione
```
Expected: nuovo branch creato e trackato su origin (push OK, "new branch").

**Nessun commit in T0.**

---

## Task 1: Installa dipendenze @dnd-kit

**Files:**
- Modify: `app/package.json` — aggiunge 2 deps
- Modify: `app/package-lock.json` — atomicamente da npm

**Interfaces:**
- Consumes: nessuna
- Produces: `@dnd-kit/core` + `@dnd-kit/utilities` disponibili per T10

- [ ] **Step 1: Installa deps**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm install @dnd-kit/core @dnd-kit/utilities
```
Expected: exit 0. Versioni installate: `@dnd-kit/core ^6.x` e `@dnd-kit/utilities ^3.x` (l'esatta minor la decide npm dal registry — accettare quella stabile corrente).

- [ ] **Step 2: Verifica CI (nessun test tocca dnd-kit ora, ma controlla che install non abbia rotto typecheck/lint)**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 55/55 tests.

- [ ] **Step 3: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/package.json app/package-lock.json
git commit -m "RS-6 RS-2: aggiunge @dnd-kit/core + @dnd-kit/utilities per calendario F1.5b-alpha"
git push origin feature/f1-5b-alpha-workflow-programmazione
```

---

## Task 2: Migrazione enum extension + test enum-extended

**Files:**
- Create: `app/supabase/migrations/20260918000001_content_drafts_status_scheduled_published.sql`
- Create: `app/tests/invariants/content-draft-status-enum-extended.test.ts`

**Interfaces:**
- Consumes: enum `content_draft_status` esistente (`draft`|`approved`|`rejected`)
- Produces: enum esteso con `scheduled` + `published`, disponibile ai task successivi

- [ ] **Step 1: Scrivi test (TDD RED — assume enum ancora vecchio, atteso fallire)**

Create `app/tests/invariants/content-draft-status-enum-extended.test.ts`:

```typescript
// RS-3 RF-3.5: enum content_draft_status esteso con 'scheduled' e 'published'.
// Test che inserimenti con questi valori enum riescano.
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("content_draft_status: enum esteso con scheduled+published (RF-3.5)", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — enum extended" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org fallito: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-enum-${orgId.slice(0, 8)}`,
        display_name: "Brand Enum Test",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data)
      throw new Error(`Setup brand fallito: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  it("INSERT status='scheduled' con approved_at + scheduled_at futuri riesce", async () => {
    const approvedAt = new Date();
    const scheduledAt = new Date(approvedAt.getTime() + 24 * 60 * 60 * 1000); // +24h
    const res = await admin
      .from("content_drafts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        channel: "social",
        theme_input: "test enum scheduled",
        generated_text: "testo scheduled",
        prompt_version: "v1",
        model_used: "m",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        status: "scheduled",
        approved_at: approvedAt.toISOString(),
        scheduled_at: scheduledAt.toISOString(),
      })
      .select("id, status")
      .single();
    expect(res.error).toBeNull();
    expect((res.data as { status: string } | null)?.status).toBe("scheduled");
  });

  it("INSERT status='published' con tutti i timestamp riesce", async () => {
    const approvedAt = new Date(Date.now() - 3 * 60 * 60 * 1000); // -3h
    const scheduledAt = new Date(Date.now() - 2 * 60 * 60 * 1000); // -2h
    const publishedAt = new Date(Date.now() - 1 * 60 * 60 * 1000); // -1h
    const res = await admin
      .from("content_drafts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        channel: "social",
        theme_input: "test enum published",
        generated_text: "testo published",
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
      })
      .select("id, status")
      .single();
    expect(res.error).toBeNull();
    expect((res.data as { status: string } | null)?.status).toBe("published");
  });
});
```

- [ ] **Step 2: Esegui test (RED atteso — enum non ancora esteso, INSERT fallirà)**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npx dotenv -e .env.local -- npm test -- content-draft-status-enum-extended 2>&1 | tail -20
```
Expected: 2 test in FAIL con errore Postgres "invalid input value for enum content_draft_status: \"scheduled\"" (o simile).

- [ ] **Step 3: Scrivi migrazione enum extension (GREEN)**

Create `app/supabase/migrations/20260918000001_content_drafts_status_scheduled_published.sql`:

```sql
-- F1.5b-α: estende content_draft_status con 'scheduled' e 'published' (RF-3.5).
-- ALTER TYPE ADD VALUE non può stare in transazione con altri DDL: file dedicato.

ALTER TYPE content_draft_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE content_draft_status ADD VALUE IF NOT EXISTS 'published';
```

- [ ] **Step 4: Applica migrazione + riesegui test (GREEN)**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npx supabase db reset
npx dotenv -e .env.local -- npm test -- content-draft-status-enum-extended 2>&1 | tail -10
```
Expected: 2/2 passing. (Nota: `supabase db reset` svuota `auth.users` — l'Owner verrà ricreato in T11.)

- [ ] **Step 5: Verifica CI completa**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, `Tests 57 passed (57)` (era 55, +2).

- [ ] **Step 6: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/supabase/migrations/20260918000001_content_drafts_status_scheduled_published.sql app/tests/invariants/content-draft-status-enum-extended.test.ts
git commit -m "RF-3.5 RS-3: enum content_draft_status esteso con scheduled+published + 2 test"
git push origin feature/f1-5b-alpha-workflow-programmazione
```

---

## Task 3: Migrazione colonne + CHECK + index + test invarianti

**Files:**
- Create: `app/supabase/migrations/20260918000002_content_drafts_scheduling_columns.sql`
- Create: `app/tests/invariants/content-draft-schedule-invariants.test.ts`

**Interfaces:**
- Consumes: enum esteso da T2
- Produces: colonne `scheduled_at`, `published_at`, 3 CHECK constraints, 1 index partial. Disponibili a T4+.

- [ ] **Step 1: Scrivi test (TDD RED — colonne/CHECK non esistono, INSERT senza CHECK riesce erroneamente)**

Create `app/tests/invariants/content-draft-schedule-invariants.test.ts`:

```typescript
// RS-3 RF-3.5: CHECK constraint su content_drafts per stati scheduled/published.
// - schedule_has_timestamp: status='scheduled' → scheduled_at NOT NULL
// - publish_has_timestamp: status='published' → published_at + scheduled_at NOT NULL
// - schedule_after_approve: scheduled_at deve essere > approved_at
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("content_drafts: CHECK invariants su scheduling (RS-3, RF-3.5)", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — schedule invariants" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org fallito: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-sched-${orgId.slice(0, 8)}`,
        display_name: "Brand Schedule",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data)
      throw new Error(`Setup brand fallito: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;
  });

  it("schedule_has_timestamp: INSERT status='scheduled' con scheduled_at NULL fallisce", async () => {
    const approvedAt = new Date();
    const res = await admin.from("content_drafts").insert({
      organization_id: orgId,
      brand_id: brandId,
      channel: "social",
      theme_input: "test schedule check",
      generated_text: "testo",
      prompt_version: "v1",
      model_used: "m",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "scheduled",
      approved_at: approvedAt.toISOString(),
      scheduled_at: null,
    });
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/schedule_has_timestamp|check/);
  });

  it("publish_has_timestamp: INSERT status='published' senza published_at fallisce", async () => {
    const approvedAt = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const scheduledAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const res = await admin.from("content_drafts").insert({
      organization_id: orgId,
      brand_id: brandId,
      channel: "social",
      theme_input: "test publish check",
      generated_text: "testo",
      prompt_version: "v1",
      model_used: "m",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "published",
      approved_at: approvedAt.toISOString(),
      scheduled_at: scheduledAt.toISOString(),
      published_at: null,
    });
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/publish_has_timestamp|check/);
  });

  it("schedule_after_approve: scheduled_at prima di approved_at fallisce", async () => {
    const approvedAt = new Date();
    const scheduledAt = new Date(approvedAt.getTime() - 60 * 1000); // 1min prima
    const res = await admin.from("content_drafts").insert({
      organization_id: orgId,
      brand_id: brandId,
      channel: "social",
      theme_input: "test schedule ordering",
      generated_text: "testo",
      prompt_version: "v1",
      model_used: "m",
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: 0,
      latency_ms: 0,
      status: "scheduled",
      approved_at: approvedAt.toISOString(),
      scheduled_at: scheduledAt.toISOString(),
    });
    expect(res.error).not.toBeNull();
    expect(res.error?.message.toLowerCase()).toMatch(/schedule_after_approve|check/);
  });
});
```

- [ ] **Step 2: Esegui test (RED atteso — colonne/CHECK non esistono, insert fallisce "column does not exist")**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npx dotenv -e .env.local -- npm test -- content-draft-schedule-invariants 2>&1 | tail -20
```
Expected: 3 test in FAIL con errori Postgres tipo `column "scheduled_at" of relation "content_drafts" does not exist`.

- [ ] **Step 3: Scrivi migrazione colonne + CHECK + index (GREEN)**

Create `app/supabase/migrations/20260918000002_content_drafts_scheduling_columns.sql`:

```sql
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
```

- [ ] **Step 4: Applica migrazione + riesegui test (GREEN)**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npx supabase db reset
npx dotenv -e .env.local -- npm test -- content-draft-schedule-invariants 2>&1 | tail -10
```
Expected: 3/3 passing.

- [ ] **Step 5: Verifica CI completa**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, `Tests 60 passed (60)` (era 57, +3).

- [ ] **Step 6: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/supabase/migrations/20260918000002_content_drafts_scheduling_columns.sql app/tests/invariants/content-draft-schedule-invariants.test.ts
git commit -m "RS-3 RF-3.5: colonne scheduled_at/published_at + 3 CHECK invariants + index parziale"
git push origin feature/f1-5b-alpha-workflow-programmazione
```

---

## Task 4: Update types + rowToDraft + SELECT_COLS

**Files:**
- Modify: `app/src/modules/m03-editorial/internal/content-drafts-types.ts`
- Modify: `app/src/modules/m03-editorial/internal/content-drafts-repo.ts` (solo `rowToDraft` + `SELECT_COLS`)

**Interfaces:**
- Consumes: colonne DB nuove da T3
- Produces: type `ContentDraftStatus` esteso, type `ContentDraft` con `scheduledAt`/`publishedAt`, `rowToDraft` mappa nuove colonne, `SELECT_COLS` include nuove colonne

- [ ] **Step 1: Aggiorna `content-drafts-types.ts`**

Sostituisci il contenuto di `app/src/modules/m03-editorial/internal/content-drafts-types.ts`:

```typescript
// M03 — Types domain per content_drafts.
// Nomi campi in inglese (identificatori codice), etichette UI in italiano.

export type ContentChannel = "social";
// F1.5b+ estenderà con: "email", "whatsapp", "sms", "google".

export type ContentDraftStatus =
  | "draft"
  | "approved"
  | "rejected"
  | "scheduled"
  | "published";
// F1.5b-α aggiunge "scheduled" + "published" (RF-3.5 workflow).
// F1.5c+ potrà aggiungere "measured" quando M9 sarà in linea.

export type ContentDraft = {
  id: string;
  organizationId: string;
  brandId: string;
  channel: ContentChannel;
  themeInput: string;
  generatedText: string;
  promptVersion: string; // es. "social-post-v1"
  modelUsed: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  status: ContentDraftStatus;
  rejectionReason: string | null;
  createdBy: string | null; // null se auth user cancellato (FK on delete set null)
  createdAt: string; // ISO
  approvedAt: string | null;
  rejectedAt: string | null;
  scheduledAt: string | null; // ISO — null se non programmato (F1.5b-α)
  publishedAt: string | null; // ISO — null se non pubblicato (F1.5b-α)
};
```

- [ ] **Step 2: Aggiorna `rowToDraft` e `SELECT_COLS` in `content-drafts-repo.ts`**

Modify `app/src/modules/m03-editorial/internal/content-drafts-repo.ts`:

Sostituisci la funzione `rowToDraft` esistente con:

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
  };
}
```

Sostituisci la constante `SELECT_COLS` esistente con:

```typescript
const SELECT_COLS =
  "id, organization_id, brand_id, channel, theme_input, generated_text, " +
  "prompt_version, model_used, tokens_in, tokens_out, cost_usd, latency_ms, " +
  "status, rejection_reason, created_by, created_at, approved_at, rejected_at, " +
  "scheduled_at, published_at";
```

- [ ] **Step 3: Verifica CI**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 60/60 tests. Non abbiamo aggiunto test, ma i test esistenti che leggono draft devono continuare a passare.

- [ ] **Step 4: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/modules/m03-editorial/internal/content-drafts-types.ts app/src/modules/m03-editorial/internal/content-drafts-repo.ts
git commit -m "RF-3.5: ContentDraft type + rowToDraft con scheduled_at/published_at"
git push origin feature/f1-5b-alpha-workflow-programmazione
```

---

## Task 5: Repo functions + IDOR tenant scoping test

**Files:**
- Modify: `app/src/modules/m03-editorial/internal/content-drafts-repo.ts` — aggiunge 5 funzioni
- Create: `app/tests/invariants/content-drafts-scheduled-tenant-scoping.test.ts` — 2 asserzioni

**Interfaces:**
- Consumes: colonne DB + types da T3, T4
- Produces:
  - `scheduleDraft(draftId, organizationId, scheduledAtIso): Promise<ContentDraft | null>`
  - `unscheduleDraft(draftId, organizationId): Promise<ContentDraft | null>`
  - `markPublished(draftId, organizationId): Promise<ContentDraft | null>`
  - `listScheduledByBrandBetween(brandId, organizationId, fromIso, toIso): Promise<ContentDraft[]>`
  - `listApprovedNotScheduledByBrand(brandId, organizationId, limit): Promise<ContentDraft[]>`

- [ ] **Step 1: Scrivi test IDOR tenant scoping (TDD RED)**

Create `app/tests/invariants/content-drafts-scheduled-tenant-scoping.test.ts`:

```typescript
// RS-3 RN-87: listScheduledByBrandBetween filtra su organization_id — IDOR impossibile.
// Coerente col pattern T11 e final review F1.5a.
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { listScheduledByBrandBetween } from "@/modules/m03-editorial/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("listScheduledByBrandBetween: tenant scoping IDOR (RS-3, RN-87)", () => {
  let brandIdOrgA: string;
  let orgAId: string;
  let orgBId: string;
  const fromIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const toIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  beforeAll(async () => {
    // 2 organizzazioni isolate.
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — scheduled scoping" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup org-A fallito: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — scheduled scoping" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup org-B fallito: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-sched-${orgAId.slice(0, 8)}`,
        display_name: "Brand A Sched",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data)
      throw new Error(`Setup brand-A fallito: ${brandA.error?.message}`);
    brandIdOrgA = (brandA.data as { id: string }).id;

    // Draft scheduled per org-A (2 draft, in range).
    const approvedAt = new Date(Date.now() - 60 * 60 * 1000);
    const scheduledAt1 = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const scheduledAt2 = new Date(Date.now() + 48 * 60 * 60 * 1000);
    for (const [i, sa] of [scheduledAt1, scheduledAt2].entries()) {
      const d = await admin.from("content_drafts").insert({
        organization_id: orgAId,
        brand_id: brandIdOrgA,
        channel: "social",
        theme_input: `test sched org-a ${i}`,
        generated_text: `testo ${i}`,
        prompt_version: "v1",
        model_used: "m",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        status: "scheduled",
        approved_at: approvedAt.toISOString(),
        scheduled_at: sa.toISOString(),
        created_by: null,
      });
      if (d.error) throw new Error(`Setup draft ${i} org-A fallito: ${d.error.message}`);
    }
  });

  it("listScheduledByBrandBetween(brandIdOrgA, orgBId, ...) → [] (IDOR bloccato)", async () => {
    const result = await listScheduledByBrandBetween(brandIdOrgA, orgBId, fromIso, toIso);
    expect(result).toEqual([]);
  });

  it("listScheduledByBrandBetween(brandIdOrgA, orgAId, ...) → 2 drafts (accesso legittimo)", async () => {
    const result = await listScheduledByBrandBetween(brandIdOrgA, orgAId, fromIso, toIso);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.every((d) => d.organizationId === orgAId)).toBe(true);
    expect(result.every((d) => d.status === "scheduled" || d.status === "published")).toBe(true);
  });
});
```

- [ ] **Step 2: Esegui test (RED atteso — funzione non esiste ancora)**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npx dotenv -e .env.local -- npm test -- content-drafts-scheduled-tenant-scoping 2>&1 | tail -15
```
Expected: 2 test in FAIL (`Cannot find module '@/modules/m03-editorial/public'` con `listScheduledByBrandBetween` undefined, o simile).

- [ ] **Step 3: Aggiungi 5 funzioni a `content-drafts-repo.ts`**

Alla fine di `app/src/modules/m03-editorial/internal/content-drafts-repo.ts` aggiungi:

```typescript
/**
 * Tenant-scoped: passa status da 'approved' a 'scheduled' + set scheduled_at.
 * Guardia contro race: filtra su status='approved', se il draft è già in altro
 * stato ritorna null (0 righe update).
 */
export async function scheduleDraft(
  draftId: string,
  organizationId: string,
  scheduledAtIso: string,
): Promise<ContentDraft | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .update({ status: "scheduled", scheduled_at: scheduledAtIso })
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .eq("status", "approved")
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore programmazione draft: ${error.message}`);
  return data ? rowToDraft(data) : null;
}

/**
 * Tenant-scoped: passa status da 'scheduled' a 'approved' + azzera scheduled_at.
 * Guardia contro race: filtra su status='scheduled'.
 */
export async function unscheduleDraft(
  draftId: string,
  organizationId: string,
): Promise<ContentDraft | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .update({ status: "approved", scheduled_at: null })
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .eq("status", "scheduled")
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore annullamento programmazione: ${error.message}`);
  return data ? rowToDraft(data) : null;
}

/**
 * Tenant-scoped: passa status da 'scheduled' a 'published' + set published_at = now().
 * published_at generato lato DB con now(). Guardia contro race: filtra su status='scheduled'.
 */
export async function markPublished(
  draftId: string,
  organizationId: string,
): Promise<ContentDraft | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", draftId)
    .eq("organization_id", organizationId)
    .eq("status", "scheduled")
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore marcatura pubblicato: ${error.message}`);
  return data ? rowToDraft(data) : null;
}

/**
 * Tenant-scoped: lista drafts scheduled+published del brand nel range [from, to).
 * Usato dal calendario editoriale per popolare le celle 14gg.
 */
export async function listScheduledByBrandBetween(
  brandId: string,
  organizationId: string,
  fromIsoInclusive: string,
  toIsoExclusive: string,
): Promise<ContentDraft[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select(SELECT_COLS)
    .eq("brand_id", brandId)
    .eq("organization_id", organizationId)
    .in("status", ["scheduled", "published"])
    .gte("scheduled_at", fromIsoInclusive)
    .lt("scheduled_at", toIsoExclusive)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(`Errore lettura calendario: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToDraft);
}

/**
 * Tenant-scoped: lista drafts in stato 'approved' e non ancora programmati (scheduled_at IS NULL).
 * Usato dal drawer laterale del calendario.
 */
export async function listApprovedNotScheduledByBrand(
  brandId: string,
  organizationId: string,
  limit: number = 50,
): Promise<ContentDraft[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_drafts")
    .select(SELECT_COLS)
    .eq("brand_id", brandId)
    .eq("organization_id", organizationId)
    .eq("status", "approved")
    .is("scheduled_at", null)
    .order("approved_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Errore lettura approvati in attesa: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToDraft);
}
```

- [ ] **Step 4: Aggiungi export in `public.ts`**

Modify `app/src/modules/m03-editorial/public.ts`. Localizza la riga di export queries e sostituiscila:

```typescript
// Query (server components / RSC)
export {
  listContentDraftsByBrand,
  getContentDraft,
  listScheduledByBrandBetween,
  listApprovedNotScheduledByBrand,
} from "./internal/content-drafts-repo";
```

*(Le server actions verranno aggiunte in T6 all'export.)*

- [ ] **Step 5: Riesegui test (GREEN)**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npx dotenv -e .env.local -- npm test -- content-drafts-scheduled-tenant-scoping 2>&1 | tail -10
```
Expected: 2/2 passing.

- [ ] **Step 6: Verifica CI completa**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, `Tests 62 passed (62)` (era 60, +2).

- [ ] **Step 7: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/modules/m03-editorial/internal/content-drafts-repo.ts app/src/modules/m03-editorial/public.ts app/tests/invariants/content-drafts-scheduled-tenant-scoping.test.ts
git commit -m "RF-3.5 RN-87 RS-3: 5 repo functions scheduling + query calendario + IDOR test"
git push origin feature/f1-5b-alpha-workflow-programmazione
```

---

## Task 6: Server actions + public.ts

**Files:**
- Modify: `app/src/modules/m03-editorial/internal/actions.ts` — aggiunge 3 server actions
- Modify: `app/src/modules/m03-editorial/public.ts` — esporta le 3 actions

**Interfaces:**
- Consumes: repo functions da T5, `requireOwnedDraft` esistente
- Produces:
  - `scheduleContentDraft(draftId: string, scheduledAtIso: string): Promise<void>`
  - `unscheduleContentDraft(draftId: string): Promise<void>`
  - `markContentDraftPublished(draftId: string): Promise<void>`

- [ ] **Step 1: Aggiungi import ai vertici di `actions.ts`**

In `app/src/modules/m03-editorial/internal/actions.ts`, localizza l'import esistente dal repo e sostituiscilo con:

```typescript
import {
  markApproved,
  markRejected,
  isRateLimited,
  scheduleDraft,
  unscheduleDraft,
  markPublished,
} from "./content-drafts-repo";
```

- [ ] **Step 2: Aggiungi 3 server actions in fondo al file `actions.ts`**

Alla fine di `app/src/modules/m03-editorial/internal/actions.ts` aggiungi:

```typescript
export async function scheduleContentDraft(
  draftId: string,
  scheduledAtIso: string,
): Promise<void> {
  // 1. Validation server-side: data parsabile + strettamente futura.
  const scheduledAt = new Date(scheduledAtIso);
  if (Number.isNaN(scheduledAt.getTime())) {
    throw new Error("Data di programmazione non valida");
  }
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("La data di pubblicazione deve essere nel futuro");
  }

  // 2. Auth + ownership + status guard
  const { session, draft } = await requireOwnedDraft(draftId);
  if (draft.status !== "approved") {
    throw new Error(`Bozza in stato ${draft.status}, non programmabile`);
  }

  // 3. Repo
  const brandSlug = await getBrandSlug(draft.brand_id);
  await scheduleDraft(draftId, session.organizationId, scheduledAt.toISOString());

  // 4. Audit (RF-11.3, RA-8.12)
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_scheduled",
    target: `brand:${brandSlug}`,
    details: { draftId, scheduledAt: scheduledAt.toISOString() },
  });

  // 5. Revalidate lista + calendario
  revalidatePath(`/contenuti/${brandSlug}`);
  revalidatePath(`/contenuti/${brandSlug}/calendario`);
}

export async function unscheduleContentDraft(draftId: string): Promise<void> {
  const { session, draft } = await requireOwnedDraft(draftId);
  if (draft.status !== "scheduled") {
    throw new Error(`Bozza in stato ${draft.status}, non annullabile`);
  }

  const brandSlug = await getBrandSlug(draft.brand_id);
  await unscheduleDraft(draftId, session.organizationId);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_unscheduled",
    target: `brand:${brandSlug}`,
    details: { draftId },
  });

  revalidatePath(`/contenuti/${brandSlug}`);
  revalidatePath(`/contenuti/${brandSlug}/calendario`);
}

export async function markContentDraftPublished(draftId: string): Promise<void> {
  const { session, draft } = await requireOwnedDraft(draftId);
  if (draft.status !== "scheduled") {
    throw new Error(`Bozza in stato ${draft.status}, non pubblicabile`);
  }

  const brandSlug = await getBrandSlug(draft.brand_id);
  const updated = await markPublished(draftId, session.organizationId);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.draft_published",
    target: `brand:${brandSlug}`,
    details: { draftId, publishedAt: updated?.publishedAt ?? new Date().toISOString() },
  });

  revalidatePath(`/contenuti/${brandSlug}`);
  revalidatePath(`/contenuti/${brandSlug}/calendario`);
}
```

- [ ] **Step 3: Estendi export in `public.ts`**

Modify `app/src/modules/m03-editorial/public.ts`. Localizza la riga di export actions e sostituiscila:

```typescript
// Server actions (form submit)
export {
  generateSocialPost,
  approveContentDraft,
  rejectContentDraft,
  scheduleContentDraft,
  unscheduleContentDraft,
  markContentDraftPublished,
} from "./internal/actions";
```

- [ ] **Step 4: Verifica CI**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 62/62 tests.

- [ ] **Step 5: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/modules/m03-editorial/internal/actions.ts app/src/modules/m03-editorial/public.ts
git commit -m "RA-8.5 RA-8.12 RF-11.3: 3 server actions m03 (schedule/unschedule/markPublished)"
git push origin feature/f1-5b-alpha-workflow-programmazione
```

---

## Task 7: Draft detail extensions + schedule-form client

**Files:**
- Modify: `app/src/app/(protected)/contenuti/[slug]/[draftId]/page.tsx` — sezione azioni riscritta con branching status
- Create: `app/src/app/(protected)/contenuti/[slug]/[draftId]/schedule-form.tsx` — client form con datetime picker

**Interfaces:**
- Consumes: `scheduleContentDraft`, `unscheduleContentDraft`, `markContentDraftPublished`, `getContentDraft` da m03-editorial/public
- Produces: UI per programmare/annullare/pubblicare draft dalla pagina dettaglio

- [ ] **Step 1: Crea `schedule-form.tsx` client component**

Create `app/src/app/(protected)/contenuti/[slug]/[draftId]/schedule-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scheduleContentDraft } from "@/modules/m03-editorial/public";

function nowLocalIso(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export function ScheduleDraftForm({ draftId }: { draftId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const minAttr = nowLocalIso();

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
      action={async (formData: FormData) => {
        setError(null);
        setPending(true);
        try {
          const raw = String(formData.get("scheduledAt") ?? "");
          if (!raw) {
            setError("Seleziona una data e ora");
            return;
          }
          // Il valore di datetime-local è senza timezone: interpretalo come locale.
          const local = new Date(raw);
          if (Number.isNaN(local.getTime())) {
            setError("Data non valida");
            return;
          }
          await scheduleContentDraft(draftId, local.toISOString());
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="scheduledAt">Data e ora di pubblicazione</Label>
        <Input
          id="scheduledAt"
          name="scheduledAt"
          type="datetime-local"
          min={minAttr}
          required
          disabled={pending}
        />
        <p className="text-xs text-text-muted">
          Il sistema non pubblica automaticamente in questa fase (F1.5b-α). Quando arriva
          il momento, aprirai il draft e cliccherai &quot;Segna come pubblicato&quot;.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={pending}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          {pending ? "Programmando…" : "Programma"}
        </Button>
      </div>
    </form>
  );
}
```

*(Verifica che il componente shadcn `Input` esista in `app/src/components/ui/input.tsx`. Se non esiste, aggiungerlo tramite `npx shadcn@latest add input` — fare in questo step prima di commit.)*

- [ ] **Step 2: Aggiorna `[draftId]/page.tsx` — nuovi import**

Modify `app/src/app/(protected)/contenuti/[slug]/[draftId]/page.tsx`.

Localizza l'import esistente da `@/modules/m03-editorial/public` e sostituiscilo con:

```tsx
import {
  getContentDraft,
  approveContentDraft,
  rejectContentDraft,
  unscheduleContentDraft,
  markContentDraftPublished,
} from "@/modules/m03-editorial/public";
import type { ContentDraftStatus } from "@/modules/m03-editorial/public";
import { ScheduleDraftForm } from "./schedule-form";
```

- [ ] **Step 3: Aggiorna `StatusBadge` in `[draftId]/page.tsx` con branch scheduled+published**

Sostituisci la funzione `StatusBadge` esistente in `[draftId]/page.tsx` con:

```tsx
function StatusBadge({ status }: { status: ContentDraftStatus }) {
  if (status === "approved") {
    return (
      <Badge className="border border-success/30 bg-success/15 text-success">Approvato</Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge className="border border-danger/30 bg-danger/15 text-danger">Rifiutato</Badge>
    );
  }
  if (status === "scheduled") {
    return (
      <Badge className="border border-primary/30 bg-primary/10 text-primary">Programmato</Badge>
    );
  }
  if (status === "published") {
    return (
      <Badge className="border border-text-muted/30 bg-text-muted/10 text-text-muted">
        Pubblicato
      </Badge>
    );
  }
  return (
    <Badge className="border border-border bg-surface-muted text-text-muted">Bozza</Badge>
  );
}
```

- [ ] **Step 4: Riscrivi la sezione azioni condizionali nel body della pagina**

Nel corpo di `DraftDetailPage`, localizza la sezione che gestisce `draft.status === "draft"` (con il form approve + rifiuta con motivo) e la sezione `approved`/`rejected`. Sostituisci l'intero blocco condizionale con:

```tsx
      {draft.status === "draft" && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <form action={approveContentDraft.bind(null, draft.id)} className="flex-1">
            <Button
              type="submit"
              className="w-full bg-success text-white hover:bg-success/90"
            >
              <Check className="mr-2 h-4 w-4" /> Approva
            </Button>
          </form>

          <details className="flex-1 rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium text-danger">
              <X className="mr-1 inline h-4 w-4" /> Rifiuta con motivo
            </summary>
            <form
              action={async (formData: FormData) => {
                "use server";
                const reason = String(formData.get("reason") ?? "");
                await rejectContentDraft(draft.id, reason);
              }}
              className="mt-3 space-y-2"
            >
              <Label htmlFor="reason">Motivo (obbligatorio, 1-500 char)</Label>
              <Textarea
                id="reason"
                name="reason"
                required
                maxLength={500}
                rows={3}
                placeholder="Es. Tono troppo formale, mancano dettagli sulla promozione"
              />
              <div className="flex justify-end">
                <Button type="submit" className="bg-danger text-white hover:bg-danger/90">
                  Conferma rifiuto
                </Button>
              </div>
            </form>
          </details>
        </div>
      )}

      {draft.status === "approved" && <ScheduleDraftForm draftId={draft.id} />}

      {draft.status === "scheduled" && draft.scheduledAt && (
        <div className="space-y-3">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            <strong>Programmato</strong> per {formatDateTime(draft.scheduledAt)}.
            Il sistema non pubblica automaticamente in F1.5b-α: quando avrai
            pubblicato manualmente sul canale, torna qui e clicca &quot;Segna come
            pubblicato&quot;.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form action={unscheduleContentDraft.bind(null, draft.id)} className="flex-1">
              <Button type="submit" variant="outline" className="w-full">
                Annulla programmazione
              </Button>
            </form>
            <form action={markContentDraftPublished.bind(null, draft.id)} className="flex-1">
              <Button
                type="submit"
                className="w-full bg-primary text-white hover:bg-primary-hover"
              >
                <Check className="mr-2 h-4 w-4" /> Segna come pubblicato adesso
              </Button>
            </form>
          </div>
        </div>
      )}

      {draft.status === "approved" && draft.approvedAt && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-text-muted">
          Approvato il {formatDateTime(draft.approvedAt)}. Programmalo con il form sopra
          per farlo apparire nel calendario editoriale.
        </div>
      )}

      {draft.status === "published" && draft.publishedAt && (
        <div className="rounded-lg border border-text-muted/30 bg-text-muted/10 p-4 text-sm">
          <strong>Pubblicato</strong> il {formatDateTime(draft.publishedAt)}. Nessuna altra
          azione disponibile su questo contenuto.
        </div>
      )}

      {draft.status === "rejected" && draft.rejectedAt && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm">
          <div>
            <strong>Rifiutato</strong> il {formatDateTime(draft.rejectedAt)}.
          </div>
          <div className="mt-2">
            <strong>Motivo:</strong> {draft.rejectionReason}
          </div>
        </div>
      )}
```

- [ ] **Step 5: Verifica typecheck + CI**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 62/62 tests.

Se emerge errore `Cannot find module '@/components/ui/input'`: run `npx shadcn@latest add input` in `app/`, poi ricommit includendo il file.

- [ ] **Step 6: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/app/\(protected\)/contenuti/\[slug\]/\[draftId\]/
# Se stato aggiunto input.tsx da shadcn, includerlo:
git add app/src/components/ui/input.tsx 2>/dev/null || true
git commit -m "RF-3.5 RU-1a: dettaglio draft con azioni programma/annulla/pubblica + StatusBadge esteso"
git push origin feature/f1-5b-alpha-workflow-programmazione
```

---

## Task 8: [slug]/page.tsx — StatusBadge extension + Calendar header link

**Files:**
- Modify: `app/src/app/(protected)/contenuti/[slug]/page.tsx`

**Interfaces:**
- Consumes: `ContentDraftStatus` esteso da T4
- Produces: link "Calendario" nell'header + StatusBadge esteso con scheduled/published

- [ ] **Step 1: Aggiungi import icona Calendar**

Modify `app/src/app/(protected)/contenuti/[slug]/page.tsx`.

Localizza l'import esistente di icone da `lucide-react` (dovrebbe includere già `ArrowLeft`, `Sparkles`) e aggiungi `Calendar`:

```tsx
import { ArrowLeft, Sparkles, Calendar } from "lucide-react";
```

- [ ] **Step 2: Aggiungi link "Calendario" nell'header**

Localizza il blocco header che contiene il bottone "Nuovo contenuto" (dentro `<div className="flex items-center justify-between">`). Sostituisci solo il bottone singolo con due bottoni affiancati:

```tsx
          <div className="flex items-center gap-2">
            <Link href={`/contenuti/${brandSlug}/calendario`}>
              <Button variant="outline">
                <Calendar className="mr-2 h-4 w-4" /> Calendario
              </Button>
            </Link>
            <Link href={`/contenuti/${brandSlug}/nuovo`}>
              <Button className="bg-primary text-white hover:bg-primary-hover">
                <Sparkles className="mr-2 h-4 w-4" /> Nuovo contenuto
              </Button>
            </Link>
          </div>
```

- [ ] **Step 3: Estendi `StatusBadge` in `[slug]/page.tsx` con branch scheduled+published**

Sostituisci la funzione `StatusBadge` esistente in `[slug]/page.tsx` con la versione a 5 stati (stessa di T7):

```tsx
function StatusBadge({ status }: { status: ContentDraftStatus }) {
  if (status === "approved") {
    return (
      <Badge className="border border-success/30 bg-success/15 text-success">Approvato</Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge className="border border-danger/30 bg-danger/15 text-danger">Rifiutato</Badge>
    );
  }
  if (status === "scheduled") {
    return (
      <Badge className="border border-primary/30 bg-primary/10 text-primary">Programmato</Badge>
    );
  }
  if (status === "published") {
    return (
      <Badge className="border border-text-muted/30 bg-text-muted/10 text-text-muted">
        Pubblicato
      </Badge>
    );
  }
  return (
    <Badge className="border border-border bg-surface-muted text-text-muted">Bozza</Badge>
  );
}
```

- [ ] **Step 4: Verifica CI**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 62/62 tests.

- [ ] **Step 5: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/app/\(protected\)/contenuti/\[slug\]/page.tsx
git commit -m "RF-3.5: lista drafts con badge scheduled/published + link Calendario nell'header"
git push origin feature/f1-5b-alpha-workflow-programmazione
```

---

## Task 9: /impostazioni card "Chiavi AI" read-only

**Files:**
- Modify: `app/src/app/(protected)/impostazioni/page.tsx`

**Interfaces:**
- Consumes: `process.env["ANTHROPIC_API_KEY"]`, `process.env["VOYAGE_API_KEY"]`
- Produces: card visuale in /impostazioni che mostra status + maschera parziale

- [ ] **Step 1: Aggiungi helper mask e componente card**

Modify `app/src/app/(protected)/impostazioni/page.tsx`.

Sotto la funzione esistente `maskUrl` aggiungi un nuovo helper:

```tsx
function maskApiKey(raw: string | undefined): { present: boolean; masked: string } {
  const key = (raw ?? "").trim();
  if (!key) return { present: false, masked: "" };
  if (key.length < 12) return { present: true, masked: "configurata" };
  return { present: true, masked: `${key.slice(0, 8)}…${key.slice(-4)}` };
}
```

*(Nota: `…` è il carattere `…` — usato letterale nel template string.)*

- [ ] **Step 2: Leggi le env vars nella RSC**

Nella funzione `ImpostazioniPage`, dopo le righe che leggono `supabaseUrl` e `appVersion`/`gitSha`, aggiungi:

```tsx
  const anthropic = maskApiKey(process.env["ANTHROPIC_API_KEY"]);
  const voyage = maskApiKey(process.env["VOYAGE_API_KEY"]);
```

- [ ] **Step 3: Aggiungi card "Chiavi AI" nel JSX**

Nel JSX ritornato, dopo la card `{/* Sezione ambiente */}` e prima di `{/* Logout */}`, aggiungi:

```tsx
      {/* Sezione chiavi AI (read-only, RNF-1) */}
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="font-serif text-xl">Chiavi AI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Anthropic API (Claude, generazione testi)
            </span>
            {anthropic.present ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-success">✅ configurata</span>
                <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
                  {anthropic.masked}
                </code>
              </div>
            ) : (
              <span className="text-sm text-danger">❌ non configurata</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Voyage AI (embeddings, retrieval anti-pattern)
            </span>
            {voyage.present ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-success">✅ configurata</span>
                <code className="rounded bg-surface-muted px-2 py-1 text-xs text-text">
                  {voyage.masked}
                </code>
              </div>
            ) : (
              <span className="text-sm text-danger">
                ❌ non configurata (opzionale — F1.5a degrada senza)
              </span>
            )}
          </div>

          <p className="border-t border-border pt-3 text-xs text-text-muted">
            La modifica delle chiavi avviene in <code>app/.env.local</code> (edit + riavvio dev server).
            UI di edit + test connessione prevista in F1.6 configurazione runtime.
          </p>
        </CardContent>
      </Card>
```

*(Nota: `✅` = ✅, `❌` = ❌. Se si preferisce usare i caratteri unicode diretti è equivalente, ma il letterale funziona.)*

- [ ] **Step 4: Verifica CI**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 62/62 tests.

- [ ] **Step 5: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/app/\(protected\)/impostazioni/page.tsx
git commit -m "RNF-1: card 'Chiavi AI' read-only in /impostazioni (status + maschera parziale)"
git push origin feature/f1-5b-alpha-workflow-programmazione
```

---

## Task 10: Calendario page RSC + DnD client components

**Files:**
- Create: `app/src/app/(protected)/contenuti/[slug]/calendario/page.tsx`
- Create: `app/src/app/(protected)/contenuti/[slug]/calendario/calendar-client.tsx`
- Create: `app/src/app/(protected)/contenuti/[slug]/calendario/biweekly-grid.tsx`
- Create: `app/src/app/(protected)/contenuti/[slug]/calendario/droppable-cell.tsx`
- Create: `app/src/app/(protected)/contenuti/[slug]/calendario/draggable-card.tsx`
- Create: `app/src/app/(protected)/contenuti/[slug]/calendario/approved-drawer.tsx`
- Create: `app/src/app/(protected)/contenuti/[slug]/calendario/loading.tsx`
- Create: `app/src/app/(protected)/contenuti/[slug]/calendario/error.tsx`

**Interfaces:**
- Consumes: `listScheduledByBrandBetween`, `listApprovedNotScheduledByBrand`, `scheduleContentDraft` da m03-editorial/public
- Produces: route funzionante `/contenuti/[slug]/calendario` con vista bisettimanale + drag-drop

- [ ] **Step 1: Crea `page.tsx` RSC (fetch dati + navigation prev/next)**

Create `app/src/app/(protected)/contenuti/[slug]/calendario/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
import { Button } from "@/components/ui/button";
import {
  listScheduledByBrandBetween,
  listApprovedNotScheduledByBrand,
} from "@/modules/m03-editorial/public";
import { CalendarClient } from "./calendar-client";

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatRange(start: Date, end: Date): string {
  const s = start.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
  const e = addDays(end, -1).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${s} – ${e}`;
}

export default async function CalendarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const session = await getSessionOrRedirect();
  if (session.role !== "owner") notFound();

  const { slug } = await params;
  const { start } = await searchParams;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: brandRow } = await admin
    .from("brands")
    .select("id, slug, display_name")
    .eq("slug", slug)
    .eq("organization_id", session.organizationId)
    .maybeSingle();
  if (!brandRow) notFound();

  const brandId = brandRow.id as string;
  const displayName = brandRow.display_name as string;

  const startDate = start ? startOfDayLocal(new Date(start)) : startOfDayLocal(new Date());
  const endDate = addDays(startDate, 14);
  const prevStart = toYmd(addDays(startDate, -14));
  const nextStart = toYmd(addDays(startDate, 14));
  const todayStart = toYmd(startOfDayLocal(new Date()));
  const isToday = toYmd(startDate) === todayStart;

  const [scheduled, approved] = await Promise.all([
    listScheduledByBrandBetween(
      brandId,
      session.organizationId,
      startDate.toISOString(),
      endDate.toISOString(),
    ),
    listApprovedNotScheduledByBrand(brandId, session.organizationId, 50),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/contenuti/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Contenuti {displayName}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-serif text-3xl font-semibold text-text">
            Calendario editoriale
          </h1>
          <div className="flex items-center gap-2 text-sm">
            <Link href={`/contenuti/${slug}/calendario?start=${prevStart}`}>
              <Button variant="outline" size="sm">
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 14gg prima
              </Button>
            </Link>
            <span className="min-w-[10rem] text-center font-medium">
              {formatRange(startDate, endDate)}
            </span>
            <Link href={`/contenuti/${slug}/calendario?start=${nextStart}`}>
              <Button variant="outline" size="sm">
                14gg dopo <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </Link>
            {!isToday && (
              <Link href={`/contenuti/${slug}/calendario`}>
                <Button variant="ghost" size="sm">
                  Oggi
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <CalendarClient
        brandSlug={slug}
        startDateIso={startDate.toISOString()}
        scheduled={scheduled}
        approved={approved}
      />
    </div>
  );
}
```

- [ ] **Step 2: Crea `calendar-client.tsx` (DndContext wrapper)**

Create `app/src/app/(protected)/contenuti/[slug]/calendario/calendar-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { scheduleContentDraft } from "@/modules/m03-editorial/public";
import type { ContentDraft } from "@/modules/m03-editorial/public";
import { BiweeklyGrid } from "./biweekly-grid";
import { ApprovedDrawer } from "./approved-drawer";

type Props = {
  brandSlug: string;
  startDateIso: string;
  scheduled: ContentDraft[];
  approved: ContentDraft[];
};

export function CalendarClient({ brandSlug, startDateIso, scheduled, approved }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  async function onDragEnd(ev: DragEndEvent) {
    setError(null);
    if (!ev.over) return;
    const draftId = String(ev.active.id);
    const dateYmd = String(ev.over.id); // formato YYYY-MM-DD (dallo droppable)
    if (!dateYmd || !draftId) return;

    // Programma per le 09:00 locale del giorno scelto.
    const [y, m, d] = dateYmd.split("-").map((s) => Number(s));
    const target = new Date(y, m - 1, d, 9, 0, 0, 0);
    if (target.getTime() <= Date.now()) {
      setError("Non puoi programmare per una data passata");
      return;
    }
    setBusy(true);
    try {
      await scheduleContentDraft(draftId, target.toISOString());
      // revalidatePath dentro l'action — la RSC parent viene rirenderizzata al successivo navigate.
      // Per feedback immediato in questa vista, ricarichiamo la pagina.
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <BiweeklyGrid startDateIso={startDateIso} scheduled={scheduled} brandSlug={brandSlug} />
        <ApprovedDrawer approved={approved} />
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger shadow-lg">
          {error}
        </div>
      )}
      {busy && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-border bg-surface p-3 text-sm text-text-muted shadow-lg">
          Programmazione in corso…
        </div>
      )}
    </DndContext>
  );
}
```

- [ ] **Step 3: Crea `biweekly-grid.tsx` (griglia 2×7)**

Create `app/src/app/(protected)/contenuti/[slug]/calendario/biweekly-grid.tsx`:

```tsx
"use client";

import type { ContentDraft } from "@/modules/m03-editorial/public";
import { DroppableCell } from "./droppable-cell";

type Props = {
  startDateIso: string;
  scheduled: ContentDraft[];
  brandSlug: string;
};

function addDays(base: Date, n: number): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameLocalDate(iso: string, target: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
  );
}

export function BiweeklyGrid({ startDateIso, scheduled, brandSlug }: Props) {
  const startDate = new Date(startDateIso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cells = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(startDate, i);
    const dateYmd = toYmd(date);
    const draftsInDay = scheduled.filter((d) => d.scheduledAt && sameLocalDate(d.scheduledAt, date));
    const isPast = date < today;
    return { date, dateYmd, draftsInDay, isPast };
  });

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {cells.map(({ date, dateYmd, draftsInDay, isPast }) => (
        <DroppableCell
          key={dateYmd}
          date={date}
          dateYmd={dateYmd}
          drafts={draftsInDay}
          isPast={isPast}
          brandSlug={brandSlug}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Crea `droppable-cell.tsx`**

Create `app/src/app/(protected)/contenuti/[slug]/calendario/droppable-cell.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";
import type { ContentDraft } from "@/modules/m03-editorial/public";
import { Badge } from "@/components/ui/badge";

type Props = {
  date: Date;
  dateYmd: string; // usato come id per useDroppable
  drafts: ContentDraft[];
  isPast: boolean;
  brandSlug: string;
};

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" });
}

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export function DroppableCell({ date, dateYmd, drafts, isPast, brandSlug }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: dateYmd, disabled: isPast });

  const cellClasses = [
    "flex min-h-[140px] flex-col gap-1 rounded-md border p-2 text-xs transition-colors",
    isPast
      ? "border-border/60 bg-surface-muted/40 text-text-muted/70 cursor-not-allowed"
      : isOver
        ? "border-success bg-success/10"
        : "border-border bg-surface hover:border-border/80",
  ].join(" ");

  return (
    <div
      ref={setNodeRef}
      className={cellClasses}
      aria-label={`Cella ${formatDayHeader(date)}${isPast ? " (passata, non droppable)" : ""}`}
    >
      <div className="mb-1 font-medium text-text-muted">{formatDayHeader(date)}</div>
      {drafts.length === 0 && !isPast && (
        <div className="text-[10px] text-text-muted/60">Trascina qui</div>
      )}
      {drafts.map((d) => (
        <Link
          key={d.id}
          href={`/contenuti/${brandSlug}/${d.id}`}
          className="block rounded border border-border/60 bg-surface-muted/60 p-1.5 hover:border-primary/60"
        >
          <div className="mb-0.5 flex items-center justify-between gap-1">
            <Badge
              className={
                d.status === "published"
                  ? "border border-text-muted/30 bg-text-muted/10 px-1 py-0 text-[9px] text-text-muted"
                  : "border border-primary/30 bg-primary/10 px-1 py-0 text-[9px] text-primary"
              }
            >
              {d.status === "published" ? "Pubblicato" : "Prog."}
            </Badge>
            <span className="text-[10px] text-text-muted">
              {d.scheduledAt ? formatHour(d.scheduledAt) : ""}
            </span>
          </div>
          <div className="text-[11px] font-medium leading-tight text-text">
            {truncate(d.themeInput, 60)}
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Crea `draggable-card.tsx`**

Create `app/src/app/(protected)/contenuti/[slug]/calendario/draggable-card.tsx`:

```tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ContentDraft } from "@/modules/m03-editorial/public";

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

export function DraggableCard({ draft }: { draft: ContentDraft }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draft.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-md border border-border bg-surface p-2 shadow-sm hover:border-primary/60 active:cursor-grabbing"
      aria-label={`Trascina il contenuto: ${draft.themeInput.slice(0, 40)}`}
    >
      <div className="text-[11px] font-medium leading-tight text-text">
        {truncate(draft.themeInput, 80)}
      </div>
      <div className="mt-1 text-[10px] text-text-muted">
        {truncate(draft.generatedText, 60)}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Crea `approved-drawer.tsx`**

Create `app/src/app/(protected)/contenuti/[slug]/calendario/approved-drawer.tsx`:

```tsx
"use client";

import type { ContentDraft } from "@/modules/m03-editorial/public";
import { DraggableCard } from "./draggable-card";

export function ApprovedDrawer({ approved }: { approved: ContentDraft[] }) {
  return (
    <aside className="rounded-lg border border-border bg-surface p-3">
      <h2 className="mb-2 text-sm font-semibold text-text">
        Approvati in attesa <span className="text-text-muted">({approved.length})</span>
      </h2>
      {approved.length === 0 ? (
        <p className="text-xs text-text-muted">
          Nessun contenuto approvato in attesa di programmazione.
        </p>
      ) : (
        <div className="space-y-2">
          {approved.map((d) => (
            <DraggableCard key={d.id} draft={d} />
          ))}
        </div>
      )}
    </aside>
  );
}
```

- [ ] **Step 7: Crea `loading.tsx`**

Create `app/src/app/(protected)/contenuti/[slug]/calendario/loading.tsx`:

```tsx
export default function CalendarioLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 animate-pulse rounded bg-surface-muted" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="h-[140px] animate-pulse rounded bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Crea `error.tsx`**

Create `app/src/app/(protected)/contenuti/[slug]/calendario/error.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";

export default function CalendarioError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 p-6">
      <h2 className="font-serif text-xl font-semibold text-danger">
        Errore nel caricamento del calendario
      </h2>
      <p className="mt-2 text-sm text-text-muted">{error.message}</p>
      <Button onClick={reset} className="mt-4 bg-primary text-white hover:bg-primary-hover">
        Ricarica
      </Button>
    </div>
  );
}
```

- [ ] **Step 9: Verifica CI (typecheck + boundaries + tests)**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 62/62 tests, 19 test files. Nessuna violazione dep-cruiser (boundaries).

Se emerge violazione boundaries: verifica che tutti i client component importino da `@/modules/m03-editorial/public` e nulla da `internal`.

- [ ] **Step 10: Commit + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add app/src/app/\(protected\)/contenuti/\[slug\]/calendario/
git commit -m "RF-3.5 RF-3.6 RS-6: route /calendario con vista bisettimanale + drag-drop @dnd-kit"
git push origin feature/f1-5b-alpha-workflow-programmazione
```

---

## Task 11: Verifica finale + diario + push chiusura

**Files:**
- Modify: `docs/diario.md`

**Interfaces:**
- Consumes: risultati completi T0–T10
- Produces: diario aggiornato, cantiere chiuso pronto per merge/PR

- [ ] **Step 1: Ricrea Owner locale (se le CI di T2/T3 hanno svuotato auth.users)**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
bash scripts/dev-create-owner.sh
```
Expected: output finale `==> Utente Owner dev pronto.`

- [ ] **Step 2: Verifica CI finale**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, `Test Files 22 passed (22)` (era 19, +3), `Tests 62 passed (62)`.

- [ ] **Step 3: Sanity smoke test manuale (opzionale ma consigliato prima del diario)**

Se Docker + Supabase + dev server sono attivi, apri il browser su `http://localhost:3000`:
1. Login `admin@admin.com` / `admin123`
2. `/contenuti/lenny` → verifica bottone "Calendario" nell'header
3. Click Calendario → vista bisettimanale caricata, drawer laterale (potrebbe essere vuoto se nessun draft approved)
4. `/impostazioni` → verifica card "Chiavi AI" con status Anthropic ✅ + Voyage (a seconda della configurazione)

Nota: la generazione AI reale richiede credito Anthropic — vedi TODO "aggiungere credito" nel diario. Se manca il credito, la generazione fallirà con 400 ma tutto il flusso di programmazione (usando un draft creato manualmente via SQL o un draft già esistente da tour precedente) è testabile senza AI.

Se il test manuale scopre un bug non contemplato dai test invarianti: fermarsi, aprire fix round, prima di procedere al commit chiusura.

- [ ] **Step 4: Aggiorna `docs/diario.md`**

Modify `docs/diario.md`.

Sostituisci il blocco "## Adesso" esistente con:

```markdown
## Adesso

- F1.5b-α chiuso. Workflow scheduled+published + calendario bisettimanale con
  drag-and-drop + card impostazioni chiavi AI read-only — tutto in locale sul
  branch `feature/f1-5b-alpha-workflow-programmazione`, pronto per merge in
  `feature/f1-1-layout-shell`. Prossima decisione: (a) F1.5b-β (coda BullMQ +
  scheduler worker, richiede Redis/Docker o Upstash), (b) F1.5c (sessione RF-3.6
  guidata + canali multipli), (c) F1.6 (edit + test connessione chiavi AI + tetti
  spesa), (d) F1.3 (utenti Editor), (e) F1.4 (Data Hub reale).
```

Poi, sopra la voce "17 set 2026 — Hotfix RNF-9" nella sezione "## Fatto", aggiungi la nuova voce:

```markdown
- **18 set 2026 — F1.5b-α Workflow + calendario + programmazione manuale completato.**
  - State machine content_drafts estesa con `scheduled` e `published` (RF-3.5, coprendo il pezzo del workflow che F1.5a lasciava aperto). Transizioni: approved→scheduled→published (terminale). Rewind approved←scheduled possibile via "Annulla programmazione".
  - 2 migrazioni DB: enum extension (idempotente `ADD VALUE IF NOT EXISTS`) + 2 colonne timestamptz + 3 CHECK constraint (`schedule_has_timestamp`, `publish_has_timestamp`, `schedule_after_approve`) + index parziale su `(brand_id, scheduled_at) WHERE scheduled_at IS NOT NULL`.
  - 5 nuove funzioni repo (scheduleDraft/unscheduleDraft/markPublished mutator con race guards; listScheduledByBrandBetween + listApprovedNotScheduledByBrand query calendario), tutte tenant-scoped (pattern IDOR fix ripetuto per la terza volta — impossibile dimenticare).
  - 3 nuove server actions m03 (scheduleContentDraft/unscheduleContentDraft/markContentDraftPublished) con `requireOwnedDraft` + audit `editorial.draft_scheduled|unscheduled|published` + revalidatePath lista+calendario.
  - Route `/contenuti/[slug]/calendario`: vista bisettimanale (14gg a rullo) coerente con RF-3.6 doppia copertura e V-2 sessioni 30 min. Layout responsive (1 col mobile, 2 col tablet, 7 col desktop). Drawer laterale "Approvati in attesa" con card trascinabili via `@dnd-kit/core` (~30 KB, accessible, mobile touch). Drop su cella futura programma per le 09:00 default; celle passate non droppable.
  - Estensione dettaglio draft: branching per status (approved→form datetime picker "Programma", scheduled→banner blu + bottoni "Annulla"/"Segna pubblicato", published→banner grigio terminale). `StatusBadge` esteso con 2 nuovi badge (blu Programmato, grigio Pubblicato) applicato sia a `[slug]/page.tsx` che a `[draftId]/page.tsx`.
  - Card "Chiavi AI" read-only in `/impostazioni` (RNF-1): status di `ANTHROPIC_API_KEY` e `VOYAGE_API_KEY` letto server-side con maschera parziale (primi 8 + ellissi + ultimi 4). Zero edit UI, zero storage in DB — rimandato a F1.6.
  - 7 nuovi test invarianti in 3 file (enum extended: 2 asserzioni; schedule invariants CHECK: 3; scheduled tenant scoping IDOR: 2). Totale test dopo F1.5b-α: **62** (era 55). CI locale verde 62/62.
  - 2 nuove dep npm: `@dnd-kit/core` + `@dnd-kit/utilities` (UI libraries, non SDK di servizi — RS-2 rispettato).
  - Commit range: `2b4b508..HEAD` su `feature/f1-5b-alpha-workflow-programmazione` (~12 commit).
  - Prossimo sotto-cantiere: F1.5b-β (coda BullMQ) oppure F1.6 (edit chiavi + tetti spesa) oppure F1.3 (utenti Editor).
```

- [ ] **Step 5: Verifica CI un'ultima volta (nessuna regressione dal cambio doc)**

Run:
```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia/app"
npm run ci
```
Expected: exit 0, 62/62.

- [ ] **Step 6: Commit di chiusura + push**

```bash
cd "c:/Users/Andrea/Desktop/PROGETTO MARKETING ia"
git add docs/diario.md
git commit -m "RQ-7: chiusura F1.5b-alpha workflow + calendario + programmazione, aggiornamento diario"
git push origin feature/f1-5b-alpha-workflow-programmazione
```

- [ ] **Step 7: Verifica GitHub Actions verde**

Run:
```bash
gh run list --branch feature/f1-5b-alpha-workflow-programmazione --limit 3
```
Expected: ultimo run `completed` con `conclusion: success`.
Se `queued`/`in_progress`: attendere ~5 min. Se `failure`: `gh run view --log-failed 2>&1 | head -80` e indagare — probabilmente CI ambientale (variabile env mancante su GH Actions per test scoped che usano Supabase local, ma la config CI del progetto lo dovrebbe gestire già).

---

## Autoverifica del piano

### Copertura spec

| Spec sezione | Task |
|---|---|
| §1 Obiettivo + deliverable 8-punti | T11 (verifica manuale) + tutti i T precedenti |
| §2 Global constraints | Tutti i task (constraint richiamati in ogni testata) |
| §3 Architettura moduli | T4–T10 (m03 estensioni + nuove route + nessun modulo nuovo) |
| §4.1–4.2 colonne + enum | T2 (enum), T3 (colonne + CHECK) |
| §4.3 Transizioni valide | T6 (server actions con status guards) |
| §4.4 CHECK invariants | T3 (3 CHECK) + test T3 |
| §4.5 Index parziale | T3 |
| §4.6 RLS | Nessuna modifica (ereditato da F1.5a) |
| §4.7 Storicizzazione audit | T6 (3 nuovi action names editorial.draft_*) |
| §4.8 File migrazioni (2) | T2 + T3 |
| §5.1 Repo functions (5) | T5 |
| §5.2 Type updates | T4 |
| §5.3 Server actions (3) | T6 |
| §5.4 public.ts extensions | T5 (queries) + T6 (actions) |
| §6.1 Dep @dnd-kit | T1 |
| §6.2 Route calendario RSC | T10 (Step 1) |
| §6.3 Client components | T10 (Step 2–6) |
| §6.4 Layout responsive | T10 (Step 3, grid classi Tailwind) |
| §6.5 Interazione drop | T10 (Step 2, onDragEnd) |
| §6.6 Accessibility | @dnd-kit built-in + aria-label in cell/card |
| §6.7 [slug]/page.tsx extensions | T8 |
| §6.8 [draftId]/page.tsx extensions | T7 |
| §6.9 Card Chiavi AI | T9 |
| §7 Test invarianti (3 file, 7 asserzioni) | T2 (2), T3 (3), T5 (2) |
| §8 Definition of done | T11 (CI verde + push + GH Actions + diario) |
| §9 Out-of-scope | Task NON creati (garanzia YAGNI) |

### Placeholder scan

Nessun "TBD", "TODO", "implementa dopo", "simile a task N". Ogni step ha codice concreto e comandi eseguibili.

### Type consistency

- `ContentDraftStatus` definito in T4, esteso con `scheduled`+`published`, usato in T5 (repo), T6 (server actions guards), T7 (StatusBadge), T8 (StatusBadge).
- `ContentDraft.scheduledAt` / `.publishedAt` (camelCase) definiti in T4, usati in T7 (dettaglio), T8 (badge), T10 (calendario cells).
- `scheduleDraft` / `unscheduleDraft` / `markPublished` (repo signatures) definiti in T5, usati in T6 (actions).
- `scheduleContentDraft` / `unscheduleContentDraft` / `markContentDraftPublished` (server actions signatures) definiti in T6, usati in T7 (form actions) + T10 (drop handler).
- `listScheduledByBrandBetween` / `listApprovedNotScheduledByBrand` definiti in T5, usati in T10.
- `SELECT_COLS` in T4 include `scheduled_at`, `published_at` — coerente con T5 che seleziona anche queste per il return type.
- `rowToDraft` in T4 mappa entrambe le nuove colonne — coerente con `ContentDraft` type.

Nessuna incongruenza rilevata.

---

## Consegna esecuzione

Piano salvato in `docs/superpowers/plans/2026-09-18-f1-5b-alpha-workflow-programmazione.md`.

Ogni task chiude con `git push origin feature/f1-5b-alpha-workflow-programmazione`. GitHub Actions CI trigga su ogni push e restituisce feedback verde/rosso in ~3-5 min.

**Numero task:** 12 (T0 setup + T1 deps + T2/T3 migrations + T4 types + T5 repo + T6 actions + T7 dettaglio + T8 lista + T9 impostazioni + T10 calendario + T11 chiusura).

**Test totali attesi a fine cantiere:** 62 (55 preesistenti + 7 nuovi: 2 enum-extended + 3 schedule-invariants + 2 scheduled-tenant-scoping).

**Baseline HEAD:** `2b4b508` su `feature/f1-1-layout-shell`.
