# M4-γ — Generazione immagini AI per post social (FLUX via fal.ai)

> Slice dedicato di M4 (§5.4 capitolato v1.5). Copre esclusivamente RF-4.5
> (generazione immagini AI via servizi esterni intercambiabili) applicato al
> flusso post social di F1.5a+F1.5b-α. La libreria foto reali (RF-4.1, M4-α),
> i template grafici (RF-4.2, M4-δ), la routine raccolta ristoranti (RF-4.4,
> M4-η), l'anteprima adaptive per canale/formato (RF-4.6, M4-ε), i video
> (RN-83, M4-ζ), i materiali offline stampa (RF-4.7, M4-θ) e la revisione
> mensile (RN-84, M4-ι) restano fuori scope: cantieri futuri, in gran parte
> dipendenti da questo o da M4-α.

**Data:** 18 settembre 2026
**Fase capitolato:** M4 (Media e template) — slice γ dedicato alla sola generazione AI
**Dipende da:** F1.1 (layout+shell), F1.2 (brand kit — `m02-brand` per `formatBrandContextForAI`), F1.5a (motore editoriale — `m03-editorial`, `runGenerateSocialPost`, dettaglio draft esistente), F1.5b-α (state machine + calendario + card impostazioni)
**Sblocca:** M4-α (libreria foto reali potrà riusare bucket + signed URL pattern), M4-ε (multi-aspect), M4-ζ (video, che estende adapter), M5 (publishing con snapshot immagine)

---

## 1. Obiettivo

Owner ha un `content_draft` in stato `draft`/`approved`/`scheduled` (generato da F1.5a). Vuole aggiungere un'immagine coerente col post. Apre il dettaglio draft, clicca **Suggerisci prompt immagine**: Claude legge il testo del post + il brand context (Lenny/Officina/Stazione/Eni Café) e restituisce un prompt tecnico in inglese ottimizzato per FLUX. L'Owner può modificarlo, poi clicca **Genera immagine**: fal.ai (FLUX.1-dev, ~5-10s) restituisce l'immagine, il sistema la scarica e la salva in Supabase Storage. Il draft ora è associato alla sua immagine, visibile in dettaglio + thumbnail in lista/calendario. Owner può rigenerare, modificare prompt, o eliminare. L'immagine è immutabile una volta il draft è `published`/`rejected`.

**Deliverable minimo verificabile a mano:**
1. Login Owner → `/contenuti/lenny/{draftId}` di un draft esistente approved.
2. Sezione "Immagine del post" mostra bottone "Suggerisci prompt immagine".
3. Click "Suggerisci prompt" → attesa ~2-3s → textarea popolata con prompt inglese contestuale + dropdown modello (FLUX dev / schnell) + bottone "Genera immagine".
4. Click "Genera immagine" → spinner ~5-10s → immagine 1024×1024 appare, chip meta (modello, costo, timestamp), prompt readonly + 3 bottoni azione.
5. Click "Rigenera" → nuova immagine diversa (nuovo seed) con stesso prompt. File vecchio cancellato dal bucket.
6. Click "Modifica prompt" → textarea diventa editabile, dopo edit "Genera con nuovo prompt" produce immagine con nuovo prompt.
7. Torna alla lista `/contenuti/lenny` → il draft ora mostra thumbnail accanto al tema.
8. Vai al calendario `/contenuti/lenny/calendario` → se il draft è scheduled, la card nella cella mostra thumbnail.
9. Click "Elimina" nel dettaglio con conferma → immagine cancellata da Storage + colonne DB azzerate + thumbnail sparisce.
10. `/audit` mostra `editorial.draft_image_generated`, `editorial.draft_image_deleted` per il draft.
11. `/impostazioni` card "Chiavi AI" mostra anche `FAL_API_KEY` (aggiornata da hotfix F1.5b-α — se preferisci evitare doppia scoperta, verifichiamo che appaia).
12. Prova a rigenerare/eliminare immagine su un draft `published` (se ne hai uno) → azione bloccata con messaggio "Bozza pubblicata, immagine immutabile (RF-5.7)".

**Cosa NON fa M4-γ:**
- Nessuna libreria foto reali upload umano (M4-α) — Owner non può caricare le proprie foto in questo slice.
- Nessun multi-aspect ratio — solo 1:1 (1024×1024). Instagram Story 9:16, feed 4:5 in M4-ε.
- Nessuna N-immagine per draft — solo 1. Carousel in M4-ε/M5.
- Nessun editing immagine (crop, filtri, testo sovrimpresso).
- Nessuna auto-generazione — sempre bottone esplicito Owner.
- Nessun template grafico brand (RF-4.2) — M4-δ.
- Nessun video (RN-83) — M4-ζ.
- Nessuna raccolta materiale ristoranti (RF-4.4) — M4-η.
- Nessuna preview per canale (RF-4.6) — M4-ε.
- Nessun cleanup wizard mensile (RN-84) — M4-ι.
- Nessuna gestione autorizzazione terzi RF-6a.2 (partner spesa, logo Eni) — arriverà in modulo dedicato quando M5 publish sarà attivo; per ora il prompt Claude instruction include "NON menzionare marchi terzi con vincoli" come mitigazione soft.

---

## 2. Global constraints (dal capitolato + progetto)

- **RQ-1** ID nei commit + convenzione `<IDs>: <descrizione italiano>`.
- **RQ-7** TS strict + lint + `npm run ci` verde + `git push origin` dopo ogni commit.
- **RS-1** Confini modulo verificati da dep-cruiser: nuove server actions restano dentro `m03-editorial/internal/`. UI in `[draftId]/page.tsx` importa da `m03-editorial/public`, mai da internal.
- **RS-2** Nuovo adapter `lib/ai/fal.ts` è l'**unica porta** all'API fal.ai. Nessun altro file importa `fetch()` verso `fal.run`. Adapter intercambiabile (RF-4.5): il dominio applicativo non conosce fal.ai — passa da `generateImage({prompt, model})`.
- **RS-3** Invarianti in DB: 5 CHECK constraint sulle 5 colonne image_* (4 individuali + 1 all-or-nothing). RLS bucket Storage `content-media` denial-by-default per anon; org-scoped per authenticated.
- **RS-4** Non applicabile (nessuna coda; generation è sync in Server Action <30s).
- **RS-5** Nessuna nuova costante commerciale. Il pricing FLUX (`$0.025 dev`, `$0.003 schnell`) è **costante di accounting**, hardcoded con commento "aggiornare quando fal.ai cambia listino". Se cambia >2x/anno, migreremo a config store.
- **RS-6** Framework nel modo canonico: Server Actions React 19 con `"use server"`, `next/image` per rendering, `next/navigation` router.refresh() dopo action success, Supabase Storage JS SDK per upload/signed URL.
- **RS-7** Nessuna ottimizzazione speculativa. Signed URL generata inline nella RSC ogni request (no cache client per ora). Se emergesse lentezza, batch upstream.
- **RS-8** Migrazione versionata `20260918000004_content_drafts_image_columns.sql` (14 cifre continue: 20260918 + 000004 = quarta migrazione del giorno).
- **RN-72** Il system prompt Claude per image-prompt-composer include esplicitamente: "NON inventare dati concreti (prezzi, orari, nomi) che non sono già nel post". FLUX comunque è debole su testo dentro immagine — mitigazione tecnica addizionale.
- **RN-87** Tutte le repo function `setDraftImage`/`clearDraftImage`/`getDraftImagePath` accettano `organizationId` obbligatorio con `.eq("organization_id", organizationId)` (pattern IDOR fix ripetuto).
- **RU-1a** M4-γ solo Owner: server actions e RSC (via `[draftId]/page.tsx` esistente) chiamano `notFound()` se non owner.
- **RA-8.5** Server actions come strumenti tipizzati, autorizzazione applicata dal codice.
- **RA-8.12** Audit obbligatorio per generate/delete image: `editorial.draft_image_generated`, `editorial.draft_image_deleted`. Suggest prompt è read-only, no audit.
- **RA-8.7** Input Owner (prompt editato) passa a fal.ai senza marker XML — fal.ai non è un LLM di comando, è un image gen model. Ma il prompt originale suggerito da Claude passa attraverso il composer con testo post trattato come contenuto (già delimitato nell'analoga logica social-post).
- **RF-4.5** Adapter intercambiabile, fornitore fal.ai scelto perché state-of-the-art (FLUX) + best latency + best price + ToS clear per uso commerciale.
- **RF-5.7** Log pubblicazione immutabile: immagine di draft `published` non può essere modificata/eliminata (status guard nelle server actions).
- **RF-11.3** `logAuditEvent` per ogni generate/delete image action con `target: brand:<slug>` e `details` (draftId + metadata immagine, ma NON il prompt full per non gonfiare l'audit — solo length + hash primo/ultimo 8 char per traceability).
- **RNF-1** `FAL_API_KEY` non nel repo. `.env.local.example` mostra template vuoto. Card "Chiavi AI" in `/impostazioni` (già presente da F1.5b-α) va estesa per mostrare status FAL_API_KEY con maschera.
- **RNF-9** Fallback fal.ai down: `generateContentDraftImage` ritorna `{ok:false, error}`, l'immagine non viene salvata, il draft resta senza immagine (o mantiene la precedente). Nessuno stato parziale.

**Lingua:** identificatori codice inglese; UI/commenti/docs italiano; prompt AI immagine in **inglese** (FLUX funziona meglio in inglese).

---

## 3. Architettura e moduli

M4-γ **estende `m03-editorial`**, NON crea modulo M4 nuovo. La libreria foto reali (M4-α), template (M4-δ), preview adaptive (M4-ε) e altri sotto-cantieri di M4 vivranno in un modulo dedicato `m04-media` quando serviranno abbastanza da giustificarlo. Per YAGNI, M4-γ resta dentro m03.

**Cambi in `m03-editorial`:**
- `internal/content-drafts-repo.ts` → +3 mutator/query (`setDraftImage`, `clearDraftImage`, `getDraftImagePath`)
- `internal/content-drafts-types.ts` → estende `ContentDraft` con 5 nuovi campi image (tutti nullable)
- `internal/image-prompt-composer.ts` — NEW, funzione pura che compone system+user message per Claude
- `internal/prompts/image-prompt.md` — NEW, system prompt template per Claude
- `internal/generate-image.ts` — NEW, orchestratore che chiama fal.ai + upload Storage + cleanup file vecchio
- `internal/actions.ts` → +3 server actions (`suggestImagePrompt`, `generateContentDraftImage`, `deleteContentDraftImage`)
- `public.ts` → esporta le 3 nuove server actions + tipi image estesi

**Nuovo adapter esterno (RS-2):**
- `lib/ai/fal.ts` — unica porta a fal.ai API. Pattern identico a `lib/ai/anthropic.ts`/`lib/ai/voyage.ts`. Nessun SDK obbligatorio (fal.ai HTTP REST via `fetch`).

**Nuovo bucket Supabase Storage:**
- `content-media` (privato, RLS per org, file limit 5MB).

**Route UI: nessuna nuova.** Modifiche a route esistenti:
- `[draftId]/page.tsx` (RSC) → aggiunge sezione "Immagine del post" via nuovo componente `image-section.tsx` (client)
- `[slug]/page.tsx` (RSC) → aggiunge thumbnail nella tabella drafts via `image-thumbnail.tsx` (RSC helper)
- `[slug]/calendario/droppable-cell.tsx` (client) → aggiunge thumbnail nelle card scheduled
- `impostazioni/page.tsx` (RSC) → aggiunge `FAL_API_KEY` alla card "Chiavi AI" esistente

**Nuovi componenti:**
- `[slug]/[draftId]/image-section.tsx` (client) — sezione dettaglio con textarea prompt + bottoni + preview
- `src/components/media/image-thumbnail.tsx` (RSC async helper) — thumbnail con signed URL

**Zero cambiamenti a:** generazione testo esistente (F1.5a `runGenerateSocialPost` invariato), workflow F1.5b-α (schedule/publish invariato), F1.5a fallback RNF-9 Voyage, tutti gli altri moduli.

**Confini rispettati (RS-1):** verificato da `m03-editorial-boundaries.test.ts` esistente + dep-cruiser config. Nessun UI component importa da `internal/`.

---

## 4. Modello dati, migrazioni, Storage bucket

### 4.1 Nuove colonne su `content_drafts`

| colonna | tipo | note |
|---|---|---|
| `image_url` | `text NULL` | path relativo nel bucket, es. `{orgId}/{draftId}.jpg` |
| `image_prompt` | `text NULL` | prompt inglese usato per la generazione |
| `image_model` | `text NULL` | `flux-dev` o `flux-schnell` |
| `image_cost_usd` | `numeric(10,4) NULL` | costo della singola call fal.ai in USD |
| `image_generated_at` | `timestamptz NULL` | timestamp generazione (per audit + UI display) |

### 4.2 CHECK constraint

- `image_prompt_length` → `image_prompt IS NULL OR char_length(image_prompt) BETWEEN 1 AND 2000`
- `image_model_enum` → `image_model IS NULL OR image_model IN ('flux-dev','flux-schnell')`
- `image_cost_non_negative` → `image_cost_usd IS NULL OR image_cost_usd >= 0`
- `image_all_or_nothing` → `(image_url IS NULL AND image_prompt IS NULL AND image_model IS NULL AND image_cost_usd IS NULL AND image_generated_at IS NULL) OR (image_url IS NOT NULL AND image_prompt IS NOT NULL AND image_model IS NOT NULL AND image_cost_usd IS NOT NULL AND image_generated_at IS NOT NULL)`

**Nota su all-or-nothing:** impedisce stati parziali (es. immagine caricata ma prompt perso, o prompt salvato senza immagine). Se `image_url` è valorizzato, TUTTI e 5 devono esserlo.

### 4.3 Bucket Supabase Storage

- **Nome:** `content-media`
- **Public:** `false` (accesso solo via signed URL server-generate)
- **File size limit:** 5 MB per file (FLUX produce ~500KB-1MB, margine ampio)
- **MIME allowed:** `image/jpeg`, `image/png`, `image/webp` (FLUX restituisce JPG per default via fal.ai)

### 4.4 Storage RLS policy

**SELECT** (per download signed URL):
```sql
CREATE POLICY "org owner can read own media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'content-media'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM users_profile WHERE user_id = auth.uid()
  )
);
```

**INSERT** (per upload dal server action con service_role bypass, ma anche authenticated per future):
```sql
CREATE POLICY "org owner can insert own media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'content-media'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM users_profile WHERE user_id = auth.uid()
  )
);
```

**DELETE** analoga a INSERT. **UPDATE** analoga (per replace).

**Denial-by-default:** anon role non ha policy → nessun accesso al bucket.

Nota: il server action usa `getAdminClient()` (service_role) che bypassa RLS ma applica tenant scoping esplicito nel path `{orgId}/{draftId}.jpg`. RLS è defense-in-depth per il caso in cui in futuro il client accedesse direttamente al bucket.

### 4.5 Migrazione file singolo

**`20260918000004_content_drafts_image_columns.sql`** (14 cifre continue):
1. `ALTER TABLE content_drafts ADD COLUMN image_url text, image_prompt text, image_model text, image_cost_usd numeric(10,4), image_generated_at timestamptz;`
2. I 4 CHECK constraint individuali
3. Il CHECK `image_all_or_nothing`
4. `INSERT INTO storage.buckets` per `content-media`
5. `CREATE POLICY` × 4 (SELECT/INSERT/UPDATE/DELETE) su `storage.objects`

**Nessun index nuovo.** Le query image sono sempre by-draft-id (già indicizzato) o by-org (per aggregate). RS-7: no ottimizzazione speculativa.

### 4.6 RLS su `content_drafts`

Già denial-by-default da F1.5a. Le 5 colonne nuove ereditano.

### 4.7 Storicizzazione RF-3.5

Le action `editorial.draft_image_generated` / `editorial.draft_image_deleted` creano audit event tracciabili. Il log audit non contiene il prompt full (solo length + hash SHA-256 dei primi 8 + ultimi 8 char, per audit trace senza gonfiare la tabella).

---

## 5. Adapter fal.ai (`lib/ai/fal.ts`)

**Pattern:** identico a `lib/ai/anthropic.ts` e `lib/ai/voyage.ts` (F1.5a). Unica porta a fal.ai API.

### 5.1 Types

```ts
export type GenerateImageInput = {
  prompt: string;
  model?: "flux-dev" | "flux-schnell";
  aspectRatio?: "square_hd" | "portrait_16_9" | "landscape_16_9";
};

export type GenerateImageResult = {
  imageBytes: Uint8Array;
  contentType: string;      // "image/jpeg" tipico
  model: string;            // "flux-dev" o "flux-schnell"
  costUsd: number;          // pricing hardcoded
  latencyMs: number;
};
```

### 5.2 Error classes

- `FalConfigError` — `FAL_API_KEY` mancante
- `FalApiError(status, message)` — 4xx/5xx dall'API fal.ai (message non include upstream body per RNF-1 sec)
- `FalTimeoutError` — timeout >30s
- `FalDownloadError` — download bytes da URL fal.ai fallito

### 5.3 Endpoint

- `POST https://fal.run/fal-ai/flux/dev` per FLUX.1-dev
- `POST https://fal.run/fal-ai/flux/schnell` per FLUX.1-schnell
- Header: `Authorization: Key <FAL_API_KEY>`, `Content-Type: application/json`
- Body: `{"prompt": "...", "image_size": "square_hd", "num_inference_steps": 28, "num_images": 1}` (schnell usa `num_inference_steps: 4`)
- Response: `{"images": [{"url": "https://fal.media/files/...", "width": 1024, "height": 1024}], "timings": {"inference": <sec>}}`

### 5.4 Flow interno

1. Verifica `FAL_API_KEY` (throw `FalConfigError`)
2. POST a endpoint scelto con `AbortController` timeout 20s
3. Se error status → throw `FalApiError` (message = `"fal.ai error HTTP {status}"`, non include upstream body)
4. Parse JSON, verifica `images[0].url` presente (altrimenti `FalApiError`)
5. Secondo `fetch` a `images[0].url` con AbortController 10s → riceve bytes JPG
6. Se download fallisce → `FalDownloadError`
7. Ritorna `{imageBytes, contentType, model, costUsd, latencyMs}`

### 5.5 Pricing hardcoded

```ts
const PRICE_PER_IMAGE_USD: Record<string, number> = {
  "flux-dev": 0.025,
  "flux-schnell": 0.003,
};
```

Commento: `// Aggiornare quando fal.ai cambia listino (verifica ~annuale su https://fal.ai/pricing).`

### 5.6 Env config

Aggiornamento `app/.env.local.example`:
```
# --- M4-γ Immagini AI ---
# fal.ai — FLUX (dev+schnell) per generazione immagini social (RS-2, §5.4 RF-4.5).
# Chiave da https://fal.ai (free tier $10 iniziali).
FAL_API_KEY=
```

---

## 6. Composer prompt + orchestratore + server actions

### 6.1 `internal/image-prompt-composer.ts` (funzione pura)

```ts
export type ComposeImagePromptInput = {
  brandDisplayName: string;
  brandContext: string;
  postText: string;
};

export function composeImagePromptSystemMessage(): string;
export function composeImagePromptUserMessage(input: ComposeImagePromptInput): string;
```

Il system message è caricato da `internal/prompts/image-prompt.md` (versioned template) via `prompt-loader.ts` esistente.

### 6.2 `internal/prompts/image-prompt.md`

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

**Prompt version:** `image-prompt-v1` (salvato in `IMAGE_PROMPT_VERSION` const, non nel DB — l'audit log conterrà la versione).

### 6.3 `internal/generate-image.ts` (orchestratore)

```ts
export type RunGenerateImageInput = {
  organizationId: string;
  draftId: string;
  prompt: string;
  model: "flux-dev" | "flux-schnell";
};

export type RunGenerateImageOutput =
  | { ok: true; imagePath: string; costUsd: number; model: string; generatedAt: string }
  | { ok: false; error: string };

export async function runGenerateImage(input: RunGenerateImageInput): Promise<RunGenerateImageOutput>;
```

**Flow:**
1. Call `generateImage({prompt, model})` da `lib/ai/fal.ts` → riceve bytes + metadata
2. Fetch immagine precedente path via `getDraftImagePath(draftId, orgId)` → se esiste, salva per cleanup
3. Upload nuovo file: `admin.storage.from('content-media').upload('{orgId}/{draftId}.jpg', imageBytes, { upsert: true, contentType })`
4. Se upload fallisce → return `{ok: false, error: "Upload Storage fallito"}` (immagine fal.ai buttata via, nessuno stato parziale)
5. Se c'era un file precedente (path diverso — es. .png vs .jpg): rimuovilo con `remove()`. Se stesso path (`upsert: true`), sovrascritto automaticamente.
6. Ritorna `{ok: true, imagePath, costUsd, model, generatedAt: new Date().toISOString()}`

**Fallback errori fal.ai:** catch `FalConfigError` / `FalApiError` / `FalTimeoutError` / `FalDownloadError` → return `{ok: false, error: <messaggio it>}`.

### 6.4 Server actions

#### `suggestImagePrompt(draftId): Promise<{ok:true; prompt:string} | {ok:false; error:string}>`

- `requireOwnedDraft(draftId)` → auth + tenant + row
- Status guard: `∈ {draft, approved, scheduled}`
- Fetch `content_drafts.generated_text` da `getContentDraft` esistente
- Fetch `formatBrandContextForAI(brandId)` da m02-brand
- Compose system+user messages via composer
- Call `generateText({systemPrompt, userMessage, maxTokens: 300})` (Claude)
- Return prompt trimmed
- **Nessun audit, nessun revalidate** (read-only)

#### `generateContentDraftImage(draftId, prompt, model): Promise<{ok:true} | {ok:false; error:string}>`

- Validation prompt: `1..2000 char`; model: `∈ {flux-dev, flux-schnell}`; default `flux-dev`
- `requireOwnedDraft(draftId)` → status ∈ mutable states
- Call `runGenerateImage({organizationId, draftId, prompt, model})`
- Se success → `setDraftImage(draftId, orgId, {url: imagePath, prompt, model, costUsd, generatedAt})`
- Audit `editorial.draft_image_generated` con `details: {draftId, model, costUsd, promptLength, promptHash: sha256(prompt).slice(0,8)+'...'+sha256(prompt).slice(-8)}`
- `revalidatePath` lista + calendario + dettaglio

#### `deleteContentDraftImage(draftId): Promise<void>`

- `requireOwnedDraft(draftId)` → status !== published/rejected
- Fetch `image_url` corrente
- `admin.storage.from('content-media').remove([image_url])`
- `clearDraftImage(draftId, orgId)` (azzera 5 colonne)
- Audit `editorial.draft_image_deleted` con `details: {draftId, deletedPath: image_url}`
- `revalidatePath` lista + calendario + dettaglio

### 6.5 Repo functions in `content-drafts-repo.ts`

```ts
export async function setDraftImage(
  draftId: string,
  organizationId: string,
  data: {
    url: string;
    prompt: string;
    model: string;
    costUsd: number;
    generatedAt: string;
  },
): Promise<ContentDraft | null>;

export async function clearDraftImage(
  draftId: string,
  organizationId: string,
): Promise<ContentDraft | null>;

export async function getDraftImagePath(
  draftId: string,
  organizationId: string,
): Promise<string | null>;
```

Tutte tenant-scoped `.eq("organization_id", organizationId)` (pattern IDOR fix ripetuto).

`setDraftImage` NON ha race guard su status (immagine può essere aggiornata in tutti i mutable states, la protezione published/rejected è a livello server action).

### 6.6 `public.ts` extensions

```ts
export type { ContentDraft, ContentDraftStatus, ContentChannel } from "./internal/content-drafts-types";
export {
  listContentDraftsByBrand,
  getContentDraft,
  listScheduledByBrandBetween,
  listApprovedNotScheduledByBrand,
} from "./internal/content-drafts-repo";
export {
  generateSocialPost,
  approveContentDraft,
  rejectContentDraft,
  scheduleContentDraft,
  unscheduleContentDraft,
  markContentDraftPublished,
  suggestImagePrompt,             // nuovo
  generateContentDraftImage,      // nuovo
  deleteContentDraftImage,        // nuovo
} from "./internal/actions";
```

Nessun export per repo image functions (accesso solo via server actions).

---

## 7. UI: dettaglio draft + thumbnail lista/calendario

### 7.1 `image-section.tsx` (client, nuovo)

Path: `app/src/app/(protected)/contenuti/[slug]/[draftId]/image-section.tsx`

**Props:**
```ts
type Props = {
  draftId: string;
  status: ContentDraftStatus;
  currentImageSignedUrl: string | null;
  currentImagePrompt: string | null;
  currentImageModel: string | null;
  currentImageCost: number | null;
  currentImageGeneratedAt: string | null;
};
```

**Stati UI:**

- **Vuoto (currentImageSignedUrl === null) + status mutable:** solo bottone `[Suggerisci prompt immagine]`.
- **Prompt suggerito (locale state):** textarea prefilled con prompt suggerito + dropdown modello + `[Suggerisci di nuovo]` + `[Genera immagine]` primario.
- **Generazione in corso (pending):** spinner + "Generazione immagine in corso... (5-15s)".
- **Immagine presente:** `<Image>` (next/image), chip meta, textarea readonly con prompt usato, 3 bottoni `[Rigenera]` / `[Modifica prompt]` / `[Elimina]`.
- **Modifica prompt:** textarea editabile, `[Genera con nuovo prompt]` primario, `[Annulla]`.
- **Status published/rejected:** solo readonly display (foto + metadata + prompt), nessun bottone azione.

**Error handling:** `useState<string | null>(error)` con banner rosso; `useState<boolean>(pending)` disabilita bottoni.

**Success handling:** `useRouter().refresh()` per revalidate RSC parent (pattern F1.5b-α final review).

### 7.2 Aggiornamento `[draftId]/page.tsx` (RSC)

- Genera signed URL per `image_url` se non null: `admin.storage.from('content-media').createSignedUrl(imagePath, 3600)`
- Passa i 6 props a `<ImageSection>`
- Inserisci il componente sotto la sezione azioni esistente

### 7.3 `image-thumbnail.tsx` (RSC helper, nuovo)

Path: `app/src/components/media/image-thumbnail.tsx`

```tsx
type Props = { imagePath: string | null; size?: number; alt?: string };
export async function ImageThumbnail({ imagePath, size = 40, alt = "Anteprima" }: Props);
```

Async component: genera signed URL (1h validity), renderizza `<Image>` quadrato `size` px con `object-cover`, rounded, border. Se `imagePath === null` → `null`.

**Nota performance:** in liste con N draft, N signed URL sequenziali. Accettabile per <20 draft (F1.5a scale). Batch upstream se emerge lentezza (M4-δ potential future task).

### 7.4 Aggiornamento `[slug]/page.tsx` (RSC)

Nella tabella drafts, prima cella (o accanto al tema): `<ImageThumbnail imagePath={d.imageUrl} size={40} alt={`Anteprima ${d.themeInput.slice(0, 30)}`} />`.

### 7.5 Aggiornamento `calendario/droppable-cell.tsx` (client)

Nelle card scheduled/published, sopra il tema, mostrare thumbnail dell'immagine se presente. **Vincolo tecnico:** `droppable-cell.tsx` è client component e non può generare signed URL server-side.

**Soluzione:** la RSC `calendario/page.tsx` pre-genera signed URLs (1h validity) per ogni draft scheduled/published che ha `image_url != null`, e le passa come nuovo field ad-hoc lungo la chain `CalendarClient` → `BiweeklyGrid` → `DroppableCell` (extend type prop `ContentDraftWithSignedImageUrl = ContentDraft & { imageSignedUrl: string | null }` locale alla route calendario). Poi il client render è puro `<Image src={draft.imageSignedUrl} />` senza async.

### 7.6 Aggiornamento `impostazioni/page.tsx` (RSC)

Aggiungi terza row nella card "Chiavi AI" esistente:
```
fal.ai (immagini FLUX)
  ✅ configurata  <maschera>
  oppure
  ❌ non configurata (opzionale — M4-γ degrada senza)
```
Usa `maskApiKey(process.env["FAL_API_KEY"])` esistente.

### 7.7 Nessun test UI in M4-γ

Coerente con F1.5a/b. Validazione tour manuale.

---

## 8. Test invarianti + boundaries

### 8.1 Test file nuovi (5 file, 13 asserzioni)

**`app/tests/invariants/content-draft-image-all-or-nothing.test.ts`** — 3 asserzioni:
1. INSERT con `image_url='x'` + altri image_* NULL → fallisce CHECK `image_all_or_nothing`
2. INSERT con tutti image_* NULL → riesce (stato normale)
3. INSERT con tutti image_* valorizzati → riesce

**`app/tests/invariants/content-draft-image-column-checks.test.ts`** — 4 asserzioni:
4. `image_prompt = ''` → fallisce CHECK length
5. `image_prompt = 'a' * 2001` → fallisce CHECK length
6. `image_model = 'sdxl'` → fallisce CHECK enum
7. `image_cost_usd = -0.01` → fallisce CHECK non-negative

**`app/tests/invariants/content-drafts-image-tenant-scoping.test.ts`** — 2 asserzioni:
8. `setDraftImage(draftIdOrgA, orgBId, {...})` → `null` (cross-org bloccato)
9. `setDraftImage(draftIdOrgA, orgAId, {...})` → success

**`app/tests/invariants/content-media-storage-rls.test.ts`** — 2 asserzioni:
10. Client anon prova `storage.from('content-media').list('{orgAId}/')` → permission denied
11. Client anon prova upload/download su `content-media/{orgAId}/test.jpg` → permission denied

**`app/tests/invariants/content-draft-image-published-immutable.test.ts`** — 2 asserzioni:
12. Server action `deleteContentDraftImage` su draft `status='published'` → throw "immagine immutabile"
13. Server action `generateContentDraftImage` su draft `status='published'` → throw "immagine immutabile"

### 8.2 Test boundaries

`m03-editorial-boundaries.test.ts` esistente cattura violazioni RS-1 dai nuovi file. Nessun test boundaries nuovo obbligatorio.

### 8.3 Test UI

Nessuno obbligatorio.

### 8.4 Totale suite dopo M4-γ

**62 baseline + 13 nuovi = 75 test.**

---

## 9. Definition of done

- `cd app && npm run ci` verde: lint + format:check + typecheck + boundaries + migrazioni + tutti i 75 test.
- Push su `origin/feature/m4-gamma-*` dopo ogni commit.
- GitHub Actions verde sull'ultimo push.
- Tour manuale end-to-end (12 step, riportati in §1) eseguibile nel browser locale con:
  - Owner `admin@admin.com` + credito Anthropic + `FAL_API_KEY` configurata
  - Docker + Supabase local attivi
  - Almeno un draft esistente in stato `approved` (creato in F1.5a) per testare "Suggerisci prompt"
- Diario `docs/diario.md` aggiornato:
  - Voce "Adesso" riscritta (M4-γ chiuso, prossime decisioni: M4-α libreria foto? M4-ε multi-ratio? F1.5c? F1.6? F1.3? F1.4?)
  - Voce "Fatto" nuova per M4-γ con sintesi (colonne, migration, adapter fal, orchestratore, actions, UI, test, costi)
  - Voce "Da non dimenticare" aggiornata: ruotare FAL_API_KEY dopo sessione (se è finita in transcript); ricordare pricing fal.ai da verificare annualmente
- Nessun placeholder (TBD/TODO) nel codice.
- Nessun eslint-disable non giustificato.

---

## 10. Out-of-scope esplicito (garanzia YAGNI)

Queste cose **NON entrano in M4-γ** e restano segnate per cantieri successivi:

- **Libreria foto reali** (RF-4.1, upload umano di foto Lenny/Officina/rider/etc.) → **M4-α**. Prerequisito diverso — richiede UI upload + tagging + browse + preview. Adapter fal.ai riusabile ma percorso di dati distinto.
- **Template grafici brand** (RF-4.2, 8 template iniziali riempiti automaticamente) → **M4-δ**. Richiede design UI/UX + progettazione template files (SVG? Canva-like?) + logica riempimento con dati brand.
- **Anteprima adaptive per canale/formato** (RF-4.6, 1:1 vs 9:16 vs 4:5) → **M4-ε**. Estende adapter con `aspectRatio` param (già presente nel type ma non usato oggi) + UI selezione formato per canale.
- **Video** (RN-83, verticale + testo + sottotitoli) → **M4-ζ**. Grosso, richiede FFmpeg o servizio esterno + processing pipeline.
- **Raccolta materiale ristoranti** (RF-4.4) → **M4-η**. Dipende da M5 publishing per inviare messaggio.
- **Materiali offline stampa** (RF-4.7) → **M4-θ**. PDF/volantini/locandine — renderer PDF a parte.
- **Revisione mensile archivio** (RN-84) → **M4-ι**. Piccolo ma serve archivio maturo (M4-α).
- **Autorizzazione terzi RF-6a.2** (partner spesa, logo Eni) → cantiere dedicato quando M5 publish arriverà. Per ora mitigazione soft nel prompt Claude ("NON menzionare marchi terzi con vincoli").
- **Editing immagine** (crop, filtri, testo sovrimpresso) → non nel capitolato attuale, valuteremo se emerge.
- **Multi-immagine per draft** (Instagram carousel) → M4-ε/M5.
- **Test UI client** su image-section.tsx → potenziale add in cantiere successivo se emergono regressioni.
- **Batch signed URL** ottimizzazione — RS-7 forbids speculative optimization. Aggiungiamo se misura di lentezza emerge.

---

## 11. Riferimenti capitolato (ID toccati)

**Funzionali:** RF-4.5 (generazione immagini via servizi esterni intercambiabili — questo cantiere è il primo implementation), RF-4.3 (verifica diritti/ToS fornitore — fal.ai commercial-friendly per FLUX hosted), RF-5.7 (log immutabile — immagine di published draft non modificabile), RN-72 (nessun dato concreto inventato — istruzione esplicita nel system prompt).

**Strutturali:** RS-1 (confini modulo), RS-2 (adapter unica porta — nuovo `lib/ai/fal.ts`), RS-3 (invarianti DB: 5 CHECK), RS-5 (pricing hardcoded con nota "aggiornare"), RS-6 (framework canonico), RS-7 (no speculativa optimization), RS-8 (migration filename).

**Autonomia/permessi:** RA-8.5 (server actions tipizzate), RA-8.12 (audit obbligatorio generate/delete), RU-1a (solo Owner).

**Naming/audit:** RN-87 (organization_id + tenant scoping), RF-11.3 (audit event per ogni action).

**Qualità/processo:** RQ-1 (ID nei commit), RQ-7 (definition of done).

**Non-funzionali:** RNF-1 (nessun segreto nel repo — FAL_API_KEY in .env.local ignorato), RNF-9 (fallback fal.ai down — server action ritorna error, no partial state).

**Vincoli progetto:** V-1 (semplicità), V-4 (budget — costo M4-γ atteso <$3/mese).
