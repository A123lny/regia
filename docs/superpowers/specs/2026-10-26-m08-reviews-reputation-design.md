# M08 Recensioni e reputazione — Design

> **Status:** Approvato in brainstorming 26 ott 2026.
> **Capitolato:** §5.8 (RF-8.1–8.9), §8.2 (categorie mai autonome), RN-61.
> **Scope F0:** core only — Google Places fetcher + classifier + bozza AI + approvazione + publish manuale. RF-8.8 (review request post-risoluzione) e RF-8.9 (commenti social) differiti.

## 1. Obiettivo

Permettere al titolare di gestire quotidianamente le recensioni Google dei suoi marchi: fetcher automatico, classificazione negative/positive/grave (RF-8.2/8.3/8.4), bozza AI tono-coerente, approvazione manuale (RF-8.5), tracking stato pubblicazione. Nessuna risposta pubblica parte mai in autonomia (§8.2). La pubblicazione effettiva su Google resta manuale a F0 (nessun brand ha oggi Google Business Profile verificato — vincolo esterno).

## 2. Decisioni di brainstorming (riferimento rapido)

| Dimensione | Scelta | Motivazione |
|------------|--------|-------------|
| Sorgente | Google Places API fetcher (read-only, API key) | Nessun OAuth, 1000 req/day free, 5 brand × 1 fetch/day = sotto quota |
| Mapping | 1 Place ID per brand | Lenny food fuori (ordini via piattaforme terze, nessuna scheda Google) |
| Classificazione | Euristica deterministica (rating + keyword grave) | Zero costi, zero latenza, predicibile (pattern diario 23 set) |
| Bozze | AI (Anthropic Claude) con brand kit + RF-8.7 | Richiesto esplicitamente dal capitolato ("bozza già pronta"), ~$0.002/bozza |
| Pubblicazione | Manuale F0 (copy clipboard + mark published) | Nessun GBP verificato oggi; OAuth implementabile solo quando ci sarà |
| Scope esclusi F0 | RF-8.8 (review request), RF-8.9 (social comments) | RF-8.8 hook da M09; RF-8.9 bloccato Meta API |

## 3. Architettura

### 3.1 Nuovo modulo

`app/src/modules/m08-reviews/` con `public.ts` (RS-1).

**Dipendenze outbound** (via `public.ts` degli altri moduli):
- `m02-brand` — lettura brand kit per prompt bozza + nuovo campo `google_place_id`
- `m03-editorial` — riuso `anthropic-adapter.ts` esistente (RS-2 unico punto AI testuale)
- `m11-audit` — append-only log transizioni stato

**Dipendenze inbound**: nessuna in F0. Altri moduli non consumano M08.

**Adapter esterno (RS-2)**: `GoogleReviewsFetcher` interface + `GooglePlacesAdapter` concreto. Unico punto di contatto con Google.

### 3.2 Capability

- `reviews.read` — Owner + Editor (lettura e navigazione)
- `reviews.respond` — Owner-only (approvazione, pubblicazione, risoluzione serious)

Separazione coerente con RU-1a (Editor non prende decisioni commerciali/di immagine pubblica).

### 3.3 Sidebar

Nuova voce "Recensioni" nel gruppo *Operativo quotidiano* (coerente con RF-8.1 "flusso giornaliero fuori dalle due sessioni settimanali"). Visibile se utente ha `reviews.read`.

## 4. Data model

### 4.1 Migration 1: colonna config brand

```sql
-- 20261027000001_m08_brand_google_place_id.sql
ALTER TABLE brands ADD COLUMN google_place_id text NULL;
COMMENT ON COLUMN brands.google_place_id IS 'Google Place ID per fetch recensioni M08. Null = brand senza scheda Google (es. Lenny food).';
```

### 4.2 Migration 2: tabella reviews

```sql
-- 20261027000002_m08_reviews.sql
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('google')),
  external_id text NOT NULL,
  author_name text,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text_original text,
  posted_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  classification text NOT NULL CHECK (classification IN ('positive','negative','serious')),
  classification_reason text,
  suggested_reply text,
  approved_reply text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending','draft_ready','approved','published_externally','serious_signaled','serious_resolved','ignored')
  ),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  published_externally_at timestamptz,
  resolved_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, source, external_id)
);

CREATE INDEX idx_reviews_pending ON reviews (organization_id, brand_id, status)
  WHERE status IN ('pending','draft_ready');
CREATE INDEX idx_reviews_posted ON reviews (organization_id, brand_id, posted_at DESC);

-- Trigger updated_at
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS tenant scoping
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY reviews_tenant ON reviews
  USING (organization_id = (SELECT auth.jwt() ->> 'org_id')::uuid);
```

### 4.3 Invarianti DB (RS-3)

- `UNIQUE(org_id, source, external_id)` — fetcher idempotente, mai duplicati
- `CHECK rating 1..5` — input Google validato lato DB
- `CHECK status IN (...)` — DB garantisce solo valori validi; le transizioni valide (pending → draft_ready → approved → published_externally) sono enforced nelle server actions, verificate dagli invarianti `m08-publish-flow.test.ts`
- `ON DELETE CASCADE` da brand/org — RN-87 tenant cleanup
- `RLS tenant` — isolamento cross-org a riposo

### 4.4 Audit (`audit_events` esistente)

Azioni registrate:
- `reviews.fetched` (meta: brand_id, count_new)
- `reviews.classified` (meta: classification, reason)
- `reviews.draft_generated` (meta: tokens_used, model)
- `reviews.approved` (meta: original_vs_approved_diff)
- `reviews.published` (meta: published_externally_at)
- `reviews.serious_resolved` (meta: resolved_notes length)

## 5. Data flow

### 5.1 Fetch daily

**Trigger**: Vercel cron `0 6 * * *` → `/api/reviews/fetch` (protetto da `CRON_SECRET`).

**Flow**:
1. `fetchAllBrandsReviews(orgId)` cicla brand con `google_place_id` not null.
2. Per ciascuno: `GooglePlacesAdapter.fetchReviews(place_id)` → fino a 5 review recenti (limite Places API).
3. `INSERT ... ON CONFLICT (org_id, source, external_id) DO NOTHING` per ciascuna → solo nuove entrano.
4. Per ogni review inserita, sincrono: `classifyReview(rating, text)` + UPDATE classification + status.
5. Enqueue async `generateReplyDraftJob(reviewId)` per quelle con classification ≠ 'serious'.

### 5.2 Classifier (deterministico, no AI)

```ts
const GRAVE_KEYWORDS = [
  'allergia','intossic','avvelenam','infortun','denuncia',
  'avvocato','carabinier','polizia','infezion','veleno','sangue'
];

function classifyReview(rating: number, text: string): {
  classification: 'positive'|'negative'|'serious';
  reason: string;
} {
  const lower = (text ?? '').toLowerCase();
  const hit = GRAVE_KEYWORDS.find(k => lower.includes(k));
  if (hit) return { classification: 'serious', reason: `keyword:${hit}` };
  if (rating <= 3) return { classification: 'negative', reason: `rating:${rating}` };
  return { classification: 'positive', reason: `rating:${rating}` };
}
```

**Soglia prudente**: rating 3 = negative (il capitolato parla di "recensione senza risposta visibile a chiunque" come problema — 3 stelle è già borderline da gestire). Modificabile via `RS-5` config in futuro.

### 5.3 Draft generation (async)

**Chiamata**: `generateReplyDraft(review, brand)` → `anthropic-adapter.ts` esistente.

**Prompt builder** costruisce:
- System: tono di voce brand + pilastri (da `m02-brand/public.ts`)
- Context: testo recensione (input non fidato RA-8.7, delimitato esplicitamente)
- Instructions: lunghezza max 500 char, in italiano, non promettere sconti/rimborsi (§8.2)
- **Vincoli brand-specific hard RA-8.6** (nel codice, non delegati al modello):
  - Se `brand.slug === 'lenny'`: istruzione esplicita "la risposta pubblica non scarica mai la colpa sul ristorante partner" (RF-8.7)
  - Se classification `negative`: tono empatico, chiede dettagli in privato
  - Se classification `positive`: tono breve e caloroso

**Post-generation guard RF-8.7**:
```ts
if (brand.slug === 'lenny') {
  const blamePattern = /ristorante.{0,30}(colpa|problema|errore|sbagli)/i;
  if (blamePattern.test(draft)) {
    throw new DraftRejectedError('RF-8.7 guard: draft scarica colpa su ristorante');
  }
}
```

Rifiuto → retry max 2 volte poi `status = 'pending'` con `draft_error` text; Owner può triggerare "Rigenera" manuale.

**Successo**: UPDATE `suggested_reply`, `status = 'draft_ready'`, audit `reviews.draft_generated`.

### 5.4 Approve

Owner apre drawer → textarea editabile pre-popolata con `suggested_reply` → modifica/approva → UPDATE `approved_reply`, `approved_by`, `approved_at`, `status = 'approved'` + audit event.

### 5.5 Publish externally (manuale)

Bottone "Copia risposta" (clipboard) + link diretto alla review su Google (costruito da `place_id` + `external_id`). Owner incolla manualmente su Google → ritorna → clic "Fatto, pubblicata" → UPDATE `status = 'published_externally'`, `published_externally_at = now()`.

### 5.6 Serious resolve (RF-8.4)

Status `serious_signaled`, nessuna bozza generata. Drawer banner rosso: "Caso grave — risolvi prima privatamente con il cliente, poi decidi se rispondere pubblicamente."

Due bottoni:
- **"Risolto privatamente"** → textarea `resolved_notes` obbligatoria (≥ 20 char) → `status = 'serious_resolved'`
- **"Prepara risposta ora"** → status torna a `pending`, enqueue draft (il che forza il modello a vedere anche questa come generabile, ma SOLO su azione esplicita Owner)

## 6. UI/UX

### 6.1 Pagina `/recensioni`

**Layout**: `AppShell` esistente + 3 sezioni.

**Header KPI** (4 card, pattern coerente con /ristoranti, /anti-abbandono):
- "Oggi" — count `fetched_at >= today`
- "Da rispondere" — count `status IN ('pending','draft_ready')`
- "Serious segnalate" — count `status = 'serious_signaled'` con badge rosso se > 0
- "Media rating 30gg" — avg rating con tendenza vs 30gg prima

**Filtri** (chip row):
- Brand (multi-select, chip con `brand.name`)
- Classification (all / positive / negative / serious)
- Status (all / da_rispondere / approvate / pubblicate)

**Tabella** (ordinata `posted_at DESC`):

| Marchio | Autore | Rating | Testo | Classificazione | Stato | Età | Azione |
|---------|--------|--------|-------|-----------------|-------|-----|--------|
| badge | nome | ★★★★☆ | truncate 80ch | badge colorato | badge | relative age | Apri |

**Età con colore semantico (RF-8.6)**:
- Lenny food: `<4h` verde · `4-12h` giallo · `12-24h` arancione · `>24h` rosso
- Altri brand: `<24h` verde · `24-48h` arancione · `>48h` rosso

**Bulk action** per `positive + draft_ready`: checkbox multi-select + bottone "Approva selezionate" (RF-8.3). Niente bulk per negative/serious.

### 6.2 Drawer dettaglio

Clic riga → `Sheet` destro con:

**Metadata header**:
- Autore + rating ★ + data posted
- Link esterno a Google review (icona)
- Brand badge

**Testo originale**: full text in un card bordato

**Sezione dinamica per status**:

- `pending`: spinner "Bozza in generazione…" + bottone fallback "Genera bozza ora"
- `draft_ready`:
  - Textarea editabile con `suggested_reply`
  - Contatore `[123/500]`
  - Bottone secondario "Rigenera" (re-chiama Anthropic)
  - Bottone primario "Approva risposta"
- `approved`:
  - Risposta read-only
  - Bottone "Copia negli appunti" (clipboard API)
  - Link "Apri recensione su Google ↗"
  - Bottone "Fatto, pubblicata su Google"
- `published_externally`:
  - Badge verde "Pubblicata il DD/MM/YYYY alle HH:mm"
- `serious_signaled`:
  - Banner rosso "Caso grave — RF-8.4"
  - Textarea `resolved_notes` (placeholder: "Come hai risolto con la persona?")
  - Bottone "Risolto privatamente" (disabled se notes < 20 char)
  - Bottone secondario "Prepara risposta ora" (rimanda a pending + enqueue draft)
- `serious_resolved`:
  - Note risoluzione visibili
  - Opzionale bottone "Prepara risposta pubblica ora"

### 6.3 Config brand

Pagina esistente `/impostazioni/brand` → nuovo campo "Google Place ID" (text input) nel form brand kit.

Help text: "Trova il Place ID del tuo marchio su https://developers.google.com/maps/documentation/places/web-service/place-id. Lascia vuoto se il marchio non ha scheda Google (es. ristorazione via piattaforme di delivery)."

## 7. Testing (RQ-3)

### 7.1 Invarianti DB-level (`tests/invariants/`)

**`m08-dedup-fetch.test.ts`** — Idempotenza fetcher:
- Insert review `(brand_A, 'google', 'ext_X')` due volte → UNIQUE constraint, 1 sola riga
- Insert stesso `external_id` ma `brand_B` diverso → consentito

**`m08-classifier.test.ts`** — Classifier deterministico (nessun DB):
- Rating 1-3 + testo neutro → negative
- Rating 4-5 + testo neutro → positive
- Rating 5 + "ho avuto allergia" → serious (keyword sovrascrive)
- Case-insensitive: "ALLERGIA" matcha
- Testo vuoto/null → gestito senza throw
- 10 casi tabella

**`m08-tenant-scoping.test.ts`** (RN-87):
- Review org A non leggibile da org B (RLS)
- UPDATE cross-tenant rifiutato

**`m08-serious-no-draft.test.ts`** (RF-8.4):
- Review classified `serious` → `suggested_reply` resta NULL dopo classify+draft job
- Transizione `serious_signaled → draft_ready` solo via azione manuale esplicita (test server action)

**`m08-publish-flow.test.ts`** (RF-8.5):
- Status machine: `pending → draft_ready → approved → published_externally` consentita
- `pending → published_externally` diretto → errore (deve passare da approved)
- Ogni transizione scrive riga `audit_events`

### 7.2 Unit test (`tests/unit/`)

**`m08-prompt-builder.test.ts`**:
- Brand Lenny → prompt generato contiene istruzione RF-8.7
- Brand non-Lenny → istruzione RF-8.7 assente (irrilevante)
- Classification `negative` → tono empatico richiesto
- Classification `positive` → brevità richiesta

**`m08-draft-guard.test.ts`**:
- Draft Lenny con "il ristorante ha fatto errore" → DraftRejectedError
- Draft Lenny con "ci scusiamo per il disservizio" → OK (nessun pattern blame)
- Draft non-Lenny con "ristorante colpa" → OK (guard brand-specific)

### 7.3 E2E (`tests/e2e/`)

**`reviews-smoke.spec.ts`**: page load `/recensioni`, 4 KPI card visibili, filtri render, tabella render.

**`reviews-flow.spec.ts`**:
1. Seed review positive via admin DB + classifier euristico applicato + mock bozza AI → drawer apre → approva → `status='approved'` + audit event scritto
2. Seed review serious via admin DB → drawer senza bozza → textarea notes + "Risolto" → `status='serious_resolved'` + audit event

**Totale nuovi test**: ~5 invarianti (15 case) + 2 unit (10 case) + 2 E2E = ~25 test case singoli.

## 8. Error handling e rate limits (RS-4)

### 8.1 Google Places API failures

| Errore | Comportamento |
|--------|---------------|
| Network/timeout | Retry 3× backoff 1/5/30 min, poi `fetch_errors` log + Owner notification |
| `INVALID_REQUEST` (place_id errato) | Disabilita fetch per brand + banner Owner "Place ID brand X non valido" |
| `OVER_QUERY_LIMIT` (improbabile: 5 req/day) | Pausa 1h, retry |
| Response parse error | Scarta la singola review, logga, prosegui le altre |

### 8.2 Anthropic failures

| Errore | Comportamento |
|--------|---------------|
| Timeout/429 | Review resta `pending` con `draft_error` text; Owner vede bottone "Rigenera" nel drawer |
| Credit exhausted | `pending` + banner globale riuso "Credito Anthropic esaurito" (già esistente da M4-γ) |
| Guard RF-8.7 fail | Scarta bozza, retry max 2 volte, poi `pending` manuale |

### 8.3 Cron scheduling

**`vercel.json`** già definisce `/api/publisher/tick`. Aggiungo:
```json
{"path":"/api/reviews/fetch","schedule":"0 6 * * *"}
```

Endpoint `/api/reviews/fetch`:
- Protetto da `Authorization: Bearer ${CRON_SECRET}` header
- Chiama `fetchAllBrandsReviews()` per ogni organization attiva
- Risponde 200 con summary `{ orgs, brands, new_reviews, errors }`

Fallback locale dev: `npm run reviews:fetch` script per trigger manuale.

### 8.4 Cleanup e retention

Review `published_externally` o `serious_resolved` più vecchie di 2 anni → flag `archived_at` (non delete, per audit). Separato job manuale, **non parte di F0** (volumi F0 ampiamente sotto soglia).

## 9. Vincoli assoluti verificati

- **§8.2 "Mai autonomo"**: nessuna risposta pubblica parte senza approvazione Owner. Verificato nel data flow (step 5.5 esplicito).
- **RA-8.6 "Il modello propone, il codice dispone"**: vincoli RF-8.7 e §8.2 nel codice del prompt builder + guard post-generation, non delegati al modello.
- **RA-8.7 "Input esterno non fidato"**: testo review entra nel prompt come contenuto delimitato, mai come istruzione (uso di tag esplicito `<customer_review>…</customer_review>`).
- **RN-87 tenant scope**: `organization_id` ovunque, RLS su `reviews`.
- **RS-1 confini modulo**: dipendenze solo via `public.ts` di altri moduli.
- **RS-2 adapter esterno**: `GoogleReviewsFetcher` interface + un unico concreto `GooglePlacesAdapter`.
- **RS-3 invarianti DB**: UNIQUE dedup, CHECK rating, CHECK status machine, RLS, CASCADE.
- **RS-4 asincrono**: fetcher idempotente, draft job con retry+backoff+DLQ.
- **RS-8 migrazioni**: 2 nuove migrazioni versionate `20261027000001`, `20261027000002`.

## 10. Fuori scope F0

- **RF-8.8 Richiesta recensione post-risoluzione**: hook da M09 abandonment resolve. Richiede: nuovo kind reminder `review_request` + template brand. Deferred a fase successiva (effort ~2h, incrementale).
- **RF-8.9 Commenti sui post social**: richiede Meta Graph API, bloccata da approvazione dev account (vedi diario). Deferred a M14 era.
- **Google Business Profile write API**: nessun brand ha oggi profilo verificato. Pubblicazione manuale F0. L'adapter write può essere wired quando GBP sarà verificato (effort ~4h).
- **Retention cleanup job**: volumi F0 non lo richiedono.

## 11. Milestone implementation (preview)

Il piano implementativo dettagliato sarà prodotto nel passo successivo via `writing-plans` skill. Preview task:

1. Migration brand `google_place_id` + migration reviews table + types
2. Repo `reviews-repo.ts` CRUD + classifier deterministico (+ unit test)
3. Adapter `google-places-adapter.ts` (RS-2) + mock per test
4. Draft generation con Anthropic + prompt builder + guard RF-8.7 (+ unit test)
5. Server actions (approve, publish, resolve serious) + capability check
6. API route `/api/reviews/fetch` cron handler + `CRON_SECRET` guard
7. UI pagina `/recensioni` + header KPI + tabella + filtri
8. UI drawer dettaglio + bulk approve positive
9. UI config brand `google_place_id` field in `/impostazioni/brand`
10. Invarianti test (5 file) + E2E test (2 spec)
11. Audit events wiring + diario aggiornamento + commit finale

Effort stimato: ~8-10h totali distribuiti su task indipendenti.

## 12. Appendice: traceability requisiti

| Requisito | Dove è implementato |
|-----------|---------------------|
| RF-8.1 flusso giornaliero | Cron 06:00 daily fetch, pagina sempre accessibile |
| RF-8.2 negative + bozza | Classifier → draft AI → drawer approva |
| RF-8.3 positive + bulk approve | Bulk action in tabella per positive+draft_ready |
| RF-8.4 serious senza bozza | Classifier → status `serious_signaled` → drawer no draft |
| RF-8.5 mai autonomo | Nessuno status transita a `published_externally` senza clic Owner |
| RF-8.6 tempi delivery/stazione | Colonna "Età" con colori semantici per brand |
| RF-8.7 Lenny no colpa ristorante | Prompt builder brand-specific + guard regex post-gen |
| RF-8.8 richiesta review post-risoluzione | **FUORI SCOPE F0** (deferred) |
| RF-8.9 commenti social | **FUORI SCOPE F0** (bloccato Meta) |
| RN-61 scheda Google officina | Campo `google_place_id` + fetcher pronto quando officina aprirà |
| §8.2 mai autonomo | Verificato: nessuna transizione a pubblicazione senza clic Owner |
| RA-8.6 codice dispone | Vincoli lunghezza + RF-8.7 nel codice, non nel modello |
| RA-8.7 input non fidato | Prompt usa tag `<customer_review>` delimitato |

---

**Pronto per generazione plan**: tutte le decisioni di scope e architettura sono fissate. Il plan dettaglierà task bite-sized (2-5 min ciascuno) con test TDD + commit frequenti, come da `superpowers:writing-plans`.
