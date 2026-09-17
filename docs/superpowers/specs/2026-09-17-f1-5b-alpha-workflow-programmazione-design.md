# F1.5b-α — Workflow + calendario editoriale + programmazione manuale

> Sotto-cantiere di M3 (§5.3 capitolato v1.5), estensione naturale di F1.5a.
> Copre il pezzo di RF-3.5 (workflow di stato) che aggiunge `scheduled` e
> `published` alla state machine, la parte del calendario editoriale utile a
> pianificare i 14 giorni successivi (RF-3.6 doppia copertura), e la
> programmazione manuale con drag-and-drop. La pubblicazione automatica su
> canali reali (M5), la coda asincrona (RS-4, BullMQ+Redis), e la misurazione
> (M9) restano fuori scope: sotto-cantieri successivi (F1.5b-β, F1.5c, M5, M9)
> le costruiranno sopra questa base.

**Data:** 17 settembre 2026
**Fase capitolato:** F1 (Data Hub, brand kit, generazione contenuti, coda approvazioni)
**Dipende da:** F1.1 (layout+shell), F1.2 (brand kit — `m02-brand`), F1.5a (generazione singola — `m03-editorial`)
**Sblocca:** F1.5b-β (coda BullMQ + scheduler worker), F1.5c (sessione RF-3.6 guidata + canali multipli), M5 (publish adapters reali), F1.6 (configurazione runtime — edit chiavi AI + test connessione + tetti spesa)

---

## 1. Obiettivo

Owner ha un content_draft in stato `approved` (F1.5a l'ha generato). Adesso vuole **decidere quando esce**. Apre `/contenuti/lenny/calendario`, vede una griglia bisettimanale (14 gg a rullo da oggi) con un drawer laterale che elenca i contenuti approvati non ancora programmati, trascina un draft su una cella del giorno voluto, il sistema lo programma per le 09:00 (default) di quella data. Quando arriva il giorno e il contenuto è stato pubblicato manualmente sul canale reale (es. copia-incollato su Facebook), l'Owner clicca "Segna come pubblicato adesso" sul dettaglio del draft.

**Deliverable minimo verificabile a mano** (dopo il tour F1.5a completato):
1. Login Owner → `/contenuti/lenny` → click "Calendario" nell'header.
2. Vista bisettimanale mostrata; drawer laterale con drafts approvati.
3. Trascina un draft su una cella futura → programmato per quella data alle 09:00, appare nella cella.
4. Torna al dettaglio del draft → badge blu "Programmato per 20 set 09:00", con bottoni "Annulla programmazione" e "Segna come pubblicato adesso".
5. Click "Segna come pubblicato adesso" → badge grigio "Pubblicato il 17 set 13:42", nessun'altra azione possibile.
6. `/audit` mostra 2 nuove voci: `editorial.draft_scheduled`, `editorial.draft_published` per il draft.
7. Prova a rimprogrammare: bottone "Annulla programmazione" → draft torna in drawer come approvato.
8. `/impostazioni` mostra card "Chiavi AI" con stato di `ANTHROPIC_API_KEY` e `VOYAGE_API_KEY` (`✅ configurata` con maschera parziale, oppure `❌ non configurata`). Read-only. Nessuna funzione di edit/test in questa fase (F1.6 dedicato).

**Cosa NON fa F1.5b-α:**
- Nessuna pubblicazione automatica su canali reali (M5 arriva dopo — richiede credenziali API social/email/WhatsApp).
- Nessuna coda asincrona BullMQ+Redis (RS-4, F1.5b-β aprirà quello quando serviranno pubblicazioni schedulate autonomamente).
- Nessuna misurazione (M9, richiede canali reali di M5).
- Nessuna sessione RF-3.6 guidata (vista dedicata "Sessione di programmazione" — F1.5c, quando il carico dimostrerà la necessità di guida).
- Nessuna corsia veloce RF-3.4 da telefono con dettatura (F1.5c).
- Nessuna richiesta anticipata materiali RF-3.9 (fuori scope, non abbiamo M4 ancora).
- Nessun ri-programma post-published (published è terminale — se serve ri-pubblicare, si crea nuovo draft).
- Nessuna vista aggregata multi-marchio (`/calendario` senza slug) — F1.5c, quando l'uso dimostrerà il bisogno.
- Nessuna validazione fasce orarie per canale (RF-5.6) — solo canale `social` oggi, l'Owner sceglie qualsiasi ora futura.
- Nessun trigger DB per bloccare rewind da `published`/`rejected` (defense-in-depth via CHECK sui campi + server actions come unica strada di scrittura).

---

## 2. Global constraints (dal capitolato + progetto)

- **RQ-1** ID nei commit + convenzione `<IDs>: <descrizione italiano>`.
- **RQ-7** TS strict + lint + `npm run ci` verde + `git push origin` dopo ogni commit.
- **RS-1** Confini di modulo verificati da dep-cruiser: nuove server actions restano dentro `m03-editorial/internal/actions.ts` esposte via `public.ts`. La UI calendario in `(protected)/contenuti/[slug]/calendario/*` importa da `m03-editorial/public` — mai da internal.
- **RS-2** Nessun SDK esterno introdotto. `@dnd-kit/core` + `@dnd-kit/utilities` sono UI libraries, non fornitori di servizi — installate come normali dipendenze npm.
- **RS-3** Invarianti in DB per i nuovi campi: 3 CHECK constraints (`schedule_has_timestamp`, `publish_has_timestamp`, `schedule_after_approve`). Enum `content_draft_status` esteso in modo backward-compatible (`ADD VALUE IF NOT EXISTS`).
- **RS-4** Non applicabile a F1.5b-α (nessuna coda BullMQ; la programmazione è sync via server action, la pubblicazione è manuale). RS-4 si applica quando arriverà lo scheduler worker (F1.5b-β).
- **RS-5** Nessuna nuova costante commerciale hardcoded. Il default orario "09:00" è UX default per drag-drop rapido, non un parametro di configurazione business.
- **RS-6** Framework nel modo canonico: Server Actions React 19 con `"use server"`, `next/navigation` per redirect/notFound, shadcn/ui + Tailwind per UI, `@dnd-kit` nel modo documentato (DndContext + useDraggable + useDroppable).
- **RS-7** Nessuna ottimizzazione speculativa. Index solo dove serve la query calendario: `(brand_id, scheduled_at) WHERE scheduled_at IS NOT NULL`.
- **RS-8** Migrazioni versionate `YYYYMMDDNNNNNN_verbo_soggetto.sql`, 14 cifre continue. Due file per rispettare il vincolo Postgres che `ALTER TYPE ADD VALUE` non può stare in transazione con altri statement.
- **RN-87** Ogni server action verifica `draft.organization_id === session.organizationId` via `requireOwnedDraft` (pattern F1.5a T10). Nuova query `listScheduledByBrandBetween` accetta `organizationId` come parametro obbligatorio con `.eq("organization_id", organizationId)` (pattern IDOR fix T11 + final review).
- **RU-1a** F1.5b-α resta **solo Owner**: ogni action e page RSC chiama `notFound()` se `session.role !== "owner"`.
- **RA-8.5** Server actions come strumenti tipizzati con autorizzazione applicata dal codice (mai delegata al modello, nessuna AI qui).
- **RA-8.12** Audit obbligatorio per ogni transizione: `editorial.draft_scheduled`, `editorial.draft_unscheduled`, `editorial.draft_published`.
- **RF-11.3** `logAuditEvent` per ogni action con `target: brand:<slug>` e `details` con `draftId` + timestamp/data.

**Lingua:** identificatori codice inglese; UI/commenti/docs italiano.

---

## 3. Architettura e moduli

F1.5b-α **estende `m03-editorial`**, non crea moduli nuovi. M5 (Publishing) resta un modulo separato del capitolato ma non arriva ora (richiede publish adapter reali).

**Cambi in `m03-editorial`:**
- `internal/content-drafts-repo.ts` — +3 mutator (`scheduleDraft`, `unscheduleDraft`, `markPublished`) + 1 query (`listScheduledByBrandBetween`).
- `internal/actions.ts` — +3 server actions omonime (`scheduleContentDraft`, `unscheduleContentDraft`, `markContentDraftPublished`) con `requireOwnedDraft` + audit + revalidate.
- `internal/content-drafts-types.ts` — enum status esteso, `ContentDraft` con `scheduledAt` + `publishedAt`.
- `public.ts` — esporta le 3 nuove server actions + `listScheduledByBrandBetween`.

**Route nuove** (dentro `(protected)/contenuti/[slug]/`):
- `calendario/page.tsx` — RSC, fetch drafts programmati + drafts approved-non-scheduled, passa al client wrapper
- `calendario/calendar-client.tsx` — client component, `DndContext` wrapper, orchestrazione drawer+grid
- `calendario/approved-drawer.tsx` — client, lista di `draggable-card` per drafts approved-non-scheduled
- `calendario/droppable-cell.tsx` — client, singola cella giorno droppable
- `calendario/draggable-card.tsx` — client, card compatta contenuto trascinabile
- `calendario/loading.tsx` + `error.tsx` — pattern F1.5a

**Route esistenti estese:**
- `[slug]/page.tsx` — header aggiunge link "Calendario" accanto a "Nuovo contenuto"; `StatusBadge` esteso con badge blu `scheduled` e grigio `published`
- `[draftId]/page.tsx` — sezione azioni riscritta con branching su status:
  - `approved` → form "Programma pubblicazione" con datetime picker + submit → `scheduleContentDraft`
  - `scheduled` → banner blu "Programmato per <data/ora>" + 2 form ("Annulla programmazione" → `unscheduleContentDraft`, "Segna come pubblicato adesso" → `markContentDraftPublished`)
  - `published` → banner grigio "Pubblicato il <data/ora>", nessuna azione
  - `draft` / `rejected` → immutato da F1.5a
- `impostazioni/page.tsx` — aggiunge card "Chiavi AI" nella sezione Ambiente (read-only, mostra presenza e maschera parziale di `ANTHROPIC_API_KEY` e `VOYAGE_API_KEY` letti da `process.env` server-side; nessuna edit UI)

**Zero nuovi moduli, zero nuove dipendenze di servizi esterni.** Solo 2 npm packages UI (`@dnd-kit/core`, `@dnd-kit/utilities`).

**Confini rispettati (RS-1):** la RSC `calendario/page.tsx` importa `listScheduledByBrandBetween` da `m03-editorial/public`; i client components sotto `calendario/` ricevono dati come props dalla RSC (nessuno importa direttamente da `internal`). Verificato automaticamente da `.dependency-cruiser.cjs` + `m03-editorial-boundaries.test.ts` esistente.

---

## 4. Modello dati e migrazioni

### 4.1 Nuove colonne su `content_drafts`

| colonna | tipo | note |
|---|---|---|
| `scheduled_at` | `timestamptz NULL` | quando l'Owner ha programmato la pubblicazione |
| `published_at` | `timestamptz NULL` | timestamp automatico su "Segna come pubblicato" |

### 4.2 Estensione enum `content_draft_status`

Da: `draft` \| `approved` \| `rejected`
A: `draft` \| `approved` \| `rejected` \| `scheduled` \| `published`

### 4.3 Transizioni valide (application-level, non enforce via DB trigger)

```
draft → approved         (approveContentDraft, F1.5a esistente)
draft → rejected         (rejectContentDraft, F1.5a esistente)
approved → scheduled     (scheduleContentDraft, F1.5b-α)
scheduled → approved     (unscheduleContentDraft, F1.5b-α)
scheduled → published    (markContentDraftPublished, F1.5b-α)
```

Stati terminali: `rejected`, `published`. Nessun rewind.

### 4.4 Nuovi CHECK invariants (RS-3)

- `schedule_has_timestamp` → `status <> 'scheduled' OR scheduled_at IS NOT NULL`
- `publish_has_timestamp` → `status <> 'published' OR (published_at IS NOT NULL AND scheduled_at IS NOT NULL)`
- `schedule_after_approve` → `scheduled_at IS NULL OR (approved_at IS NOT NULL AND scheduled_at > approved_at)`

*Nota trigger transition:* non aggiungiamo `BEFORE UPDATE trigger` per bloccare rewind da `published`/`rejected`. Le server actions sono l'unica strada di scrittura oggi, e i CHECK sopra impediscono stati malformati (es. `published` senza `published_at`). Se emergerà in futuro un bypass (RPC diretto, script di manutenzione), aggiungeremo il trigger. YAGNI ora.

### 4.5 Index

```sql
CREATE INDEX ON content_drafts (brand_id, scheduled_at)
WHERE scheduled_at IS NOT NULL;
```

Supporta la query calendario: filtra per brand + range 14 giorni su `scheduled_at`. Index parziale perché la stragrande maggioranza dei drafts non sarà mai programmata.

### 4.6 RLS

Nessuna modifica. `content_drafts` ha già RLS denial-by-default da F1.5a T4; le nuove colonne ereditano automaticamente.

### 4.7 Storicizzazione RF-3.5

Garantita dall'audit log esistente. Ogni transizione produce un `audit_event` con `action: editorial.draft_<transition>` e `details` che include timestamp/data. Nessuna tabella storia stato dedicata (over-engineering per YAGNI).

### 4.8 File migrazioni

Due file separati perché `ALTER TYPE ... ADD VALUE` non può stare in transazione con altri DDL:

**`20260917000001_content_drafts_status_scheduled_published.sql`**
```sql
ALTER TYPE content_draft_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE content_draft_status ADD VALUE IF NOT EXISTS 'published';
```

**`20260917000002_content_drafts_scheduling_columns.sql`**
```sql
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

---

## 5. Server actions, repo, public.ts

### 5.1 Repo functions in `content-drafts-repo.ts`

Tutte tenant-scoped (pattern IDOR fix T11 + final). Ritornano `null` (per mutator) o `[]` (per query) se lo scoping non matcha o se il `.eq("status", <atteso>)` guarda una race condition.

```ts
// Mutator: passa da 'approved' a 'scheduled'. Guarda contro race con .eq("status", "approved").
export async function scheduleDraft(
  draftId: string,
  organizationId: string,
  scheduledAtIso: string,
): Promise<ContentDraft | null>;

// Mutator: passa da 'scheduled' a 'approved'. Azzera scheduled_at.
export async function unscheduleDraft(
  draftId: string,
  organizationId: string,
): Promise<ContentDraft | null>;

// Mutator: passa da 'scheduled' a 'published'. published_at = now() lato DB.
export async function markPublished(
  draftId: string,
  organizationId: string,
): Promise<ContentDraft | null>;

// Query calendario: tenant-scoped, ritorna scheduled + published (per mostrare
// anche celle passate con lo storico).
export async function listScheduledByBrandBetween(
  brandId: string,
  organizationId: string,
  fromIsoInclusive: string,
  toIsoExclusive: string,
): Promise<ContentDraft[]>;
```

Query calendario SQL (via Supabase client):
```
SELECT ... FROM content_drafts
WHERE brand_id = $1
  AND organization_id = $2
  AND scheduled_at >= $3
  AND scheduled_at < $4
  AND status IN ('scheduled', 'published')
ORDER BY scheduled_at ASC
```

Query drawer (drafts approved-non-scheduled per il brand):
riusa `listContentDraftsByBrand` esistente + filtro `.eq("status", "approved")` lato caller nella page RSC, oppure aggiunge una nuova helper `listApprovedNotScheduledByBrand(brandId, organizationId)`. Preferisco la seconda per pulizia: filtro DB > filtro applicativo.

```ts
export async function listApprovedNotScheduledByBrand(
  brandId: string,
  organizationId: string,
  limit: number = 50,
): Promise<ContentDraft[]>;
```

### 5.2 Type updates in `content-drafts-types.ts`

```ts
export type ContentDraftStatus =
  | "draft"
  | "approved"
  | "rejected"
  | "scheduled"
  | "published";

export type ContentDraft = {
  // ...tutti i campi esistenti...
  scheduledAt: string | null; // ISO 8601, null se non programmato
  publishedAt: string | null; // ISO 8601, null se non pubblicato
};
```

`rowToDraft` aggiornato per mappare `scheduled_at` → `scheduledAt`, `published_at` → `publishedAt`.

### 5.3 Server actions in `actions.ts`

Pattern F1.5a: `"use server"` file-level, `requireOwnedDraft` per auth+tenant, validazione, repo call, `logAuditEvent`, `revalidatePath`.

```ts
export async function scheduleContentDraft(
  draftId: string,
  scheduledAtIso: string,
): Promise<void> {
  // 1. Validation: data parsabile + strettamente futura (server-side, non ci si
  //    fida del min HTML client).
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

  // 4. Audit
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

export async function unscheduleContentDraft(draftId: string): Promise<void>;
export async function markContentDraftPublished(draftId: string): Promise<void>;
```

`unschedule` e `markPublished` seguono lo stesso pattern, con:
- `unschedule`: guard `status === "scheduled"`, audit `editorial.draft_unscheduled`, `details: { draftId }`
- `markPublished`: guard `status === "scheduled"`, `published_at` generato dal DB (`now()`), audit `editorial.draft_published`, `details: { draftId, publishedAt: <iso restituito dalla row> }`

### 5.4 `public.ts` extensions

```ts
export type {
  ContentDraft,
  ContentDraftStatus,
  ContentChannel,
} from "./internal/content-drafts-types";

export {
  listContentDraftsByBrand,
  getContentDraft,
  listScheduledByBrandBetween,       // nuovo
  listApprovedNotScheduledByBrand,   // nuovo
} from "./internal/content-drafts-repo";

export {
  generateSocialPost,
  approveContentDraft,
  rejectContentDraft,
  scheduleContentDraft,          // nuovo
  unscheduleContentDraft,        // nuovo
  markContentDraftPublished,     // nuovo
} from "./internal/actions";
```

---

## 6. UI: calendario + estensioni dettaglio draft

### 6.1 Dipendenze nuove

```json
"dependencies": {
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/utilities": "^3.x"
}
```

Motivazione libreria: `@dnd-kit` è moderno (hooks-based), leggero (~30 KB gzipped), accessibile (keyboard + screen reader nativi), supporta touch. Alternativa `react-dnd` è più pesante e con API vintage. `dnd-kit` è la scelta di default per progetti nuovi.

### 6.2 Route `calendario/page.tsx` (RSC)

```tsx
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

  const admin = getAdminClient() as any;
  const { data: brandRow } = await admin
    .from("brands")
    .select("id, slug, display_name")
    .eq("slug", slug)
    .eq("organization_id", session.organizationId)
    .maybeSingle();
  if (!brandRow) notFound();

  // Range bisettimanale: default = oggi (00:00 locale), +14 gg.
  const startDate = start ? new Date(start) : startOfDayLocal(new Date());
  const endDate = addDays(startDate, 14);

  const [scheduled, approved] = await Promise.all([
    listScheduledByBrandBetween(
      brandRow.id, session.organizationId,
      startDate.toISOString(), endDate.toISOString(),
    ),
    listApprovedNotScheduledByBrand(brandRow.id, session.organizationId, 50),
  ]);

  return (
    <div className="space-y-6">
      <header>{/* breadcrumb, titolo, nav prev/next quindicina */}</header>
      <CalendarClient
        brandSlug={slug}
        startDate={startDate.toISOString()}
        scheduled={scheduled}
        approved={approved}
      />
    </div>
  );
}
```

### 6.3 Componenti client

- **`calendar-client.tsx`** (`"use client"`): `<DndContext onDragEnd={...}>` che orchestra:
  - Layout flex/grid con `<BiweeklyGrid />` a sinistra + `<ApprovedDrawer />` a destra
  - Handler `onDragEnd`: se drop su cella droppabile futura, invoca server action `scheduleContentDraft(draftId, dateAt09Iso)`. Se drop non valido, no-op.
- **`biweekly-grid.tsx`** (client): renderizza 14 `<DroppableCell />` in griglia CSS `grid-cols-7 grid-rows-2` (desktop). Su mobile: `grid-cols-2 grid-rows-7` (2 giorni per riga, scroll verticale) o `grid-cols-1` (una colonna). Media query Tailwind.
- **`droppable-cell.tsx`** (client): `useDroppable({ id: dateIso, disabled: dateInPast })`. Mostra data (giorno settimana + numero) + card scheduled/published del giorno. Visual: highlight verde su drag-over droppabile, rosso su non-droppabile.
- **`draggable-card.tsx`** (client): `useDraggable({ id: draftId })`. Card compatta con tema troncato + ora (per card scheduled) o solo tema (per card nel drawer).
- **`approved-drawer.tsx`** (client): colonna verticale scrollable con lista di `<DraggableCard />` per ogni draft approved-non-scheduled. Se vuota, messaggio "Nessun contenuto approvato in attesa" con link a `/contenuti/[slug]/nuovo`.

### 6.4 Layout responsive

**Desktop (`md:`)**: griglia 2×7 orizzontale + drawer laterale destro fisso (larghezza ~280 px).
**Tablet (`sm:`-`md:`)**: griglia 2×7 orizzontale, drawer diventa cassetto collassabile in alto (bottone "Approvati (N)" che apre/chiude).
**Mobile (`< sm:`)**: griglia 1 colonna × 14 righe (scroll verticale), drawer come modal fullscreen aperto da bottone floating.

### 6.5 Interazione drop

- Drop su cella oggi/futuro → `scheduleContentDraft(draftId, dateSetTo09:00Iso)`. Perché 09:00: default rapido, l'Owner cambia poi l'ora dal dettaglio se serve (unschedule + programma con altra ora).
- Drop su cella passata → rifiutato, nessuna action, feedback visivo (border rosso).
- Drop fuori grid → no-op.
- Card **scheduled** già nel calendario: **non trascinabili** (YAGNI — spostare = unschedule + drag di nuovo dal drawer).
- Card **published**: display-only, badge grigio, no drag.

### 6.6 Feedback drag (accessibility + a11y)

- `dnd-kit` fornisce native keyboard support: `Space` per pick-up, `Arrow` per navigare celle, `Enter`/`Space` per drop, `Esc` per annullare.
- Screen reader announcements built-in.
- Aggiungiamo `aria-label` descrittivi su celle e card.

### 6.7 Estensioni `[slug]/page.tsx` (lista drafts)

Nell'header, accanto al bottone "Nuovo contenuto":
```tsx
<Link href={`/contenuti/${slug}/calendario`}>
  <Button variant="outline"><Calendar className="h-4 w-4 mr-2" /> Calendario</Button>
</Link>
```

`StatusBadge` esteso con 2 nuovi rami:
- `scheduled` → chip blu (uso variabile CSS `info` se esiste, altrimenti `terracotta` con opacità)
- `published` → chip grigio scuro (`text-muted`)

### 6.8 Estensioni `[draftId]/page.tsx` (dettaglio draft)

Sezione azioni riscritta con `switch(draft.status)`:

- `draft` → immutato F1.5a (badge grigio "Bozza", no azioni pubblicabili)
- `rejected` → immutato F1.5a (banner rifiuto con motivo)
- `approved` → **nuova sezione** "Programma pubblicazione":
  - Form client `<ScheduleDraftForm draftId={id} />` con `<input type="datetime-local" min={nowIso} required />` + `<Button type="submit">Programma</Button>`
  - Server action inline: valida ISO, chiama `scheduleContentDraft`
- `scheduled` → **nuovo banner blu** "Programmato per <data/ora formattata IT>" + 2 form:
  - "Annulla programmazione" → `unscheduleContentDraft`
  - "Segna come pubblicato adesso" (evidenziato) → `markContentDraftPublished`
- `published` → **nuovo banner grigio** "Pubblicato il <data/ora formattata IT>", nessuna azione

Formattazione data/ora: helper esistente `formatDateTime(iso)` già usato per `createdAt`.

### 6.9 Estensione `impostazioni/page.tsx` — card "Chiavi AI" read-only

**Motivazione:** durante il tour manuale F1.5a è emerso che l'Owner non ha modo di sapere se `ANTHROPIC_API_KEY` e `VOYAGE_API_KEY` sono configurate senza aprire il file `.env.local`. Piccola aggiunta con alto valore di feedback immediato.

**Cosa aggiungiamo:** una card "Chiavi AI" nella sezione Ambiente esistente di `/impostazioni`. Sotto la card "Ambiente" (URL Supabase / versione / commit).

**Formato UI:**
```
┌─ Chiavi AI ─────────────────────────────────────┐
│ Anthropic API                                    │
│   ✅ configurata  sk-ant-…abc12                  │
│                                                  │
│ Voyage AI (embeddings)                           │
│   ❌ non configurata                             │
│                                                  │
│ La modifica delle chiavi avviene in app/.env.local  │
│ (edit + riavvio dev server). UI di edit + test   │
│ prevista in F1.6 configurazione runtime.         │
└──────────────────────────────────────────────────┘
```

**Comportamento:**
- Server-side only: le key sono lette da `process.env["ANTHROPIC_API_KEY"]` e `process.env["VOYAGE_API_KEY"]` nella RSC `impostazioni/page.tsx`. **Le key non arrivano mai al client**: la RSC calcola già il presente/assente e la maschera parziale, e passa al render solo booleano + stringa mascherata.
- **Maschera parziale:** primi 8 caratteri + `…` + ultimi 4 (es. `sk-ant-a…abc12`). Se la key è più corta di 12 caratteri, mostra solo `configurata` senza maschera.
- **Assente:** key vuota o non presente → mostra `❌ non configurata` senza maschera.

**Cosa NON fa questa card in F1.5b-α:**
- Nessun form di edit — F1.6 dedicato (richiede storage sicuro, encryption at rest, decisioni infrastrutturali)
- Nessun bottone "Test connessione" — F1.6 (richiede endpoint helper backend)
- Nessuna scadenza/quota mostrata — F1.6/M11 (richiede integrazione con billing API dei provider)
- Nessun rotate — F1.6

**Costo:** ~1-2 ore. Zero migrazioni DB, zero server actions, zero dipendenze nuove.

### 6.10 Nessun test UI in F1.5b-α

Coerente con F1.5a. La UI si valida nel tour manuale end-to-end. Se emergono edge case (es. sovrapposizioni card su cella affollata, click accidentale su bottone "Segna pubblicato"), aggiungiamo focused tests con vitest+@testing-library dopo.

---

## 7. Test invarianti + boundaries

**Test non negoziabili tocccati** (CLAUDE.md §"Test non negoziabili"): nessuno direttamente. F1.5b-α non tocca consensi, autonomia, margini, idempotenza invii (nessuna coda), voucher, interruttore, injection AI, tetti spesa. La copertura richiesta è quella normale per invarianti nuovi.

### 7.1 Nuovi test file

**`app/tests/invariants/content-draft-schedule-invariants.test.ts`** — 3 asserzioni:
1. `INSERT ... status='scheduled', scheduled_at=NULL` → fallimento CHECK `schedule_has_timestamp`
2. `UPDATE ... status='published', published_at=NULL` → fallimento CHECK `publish_has_timestamp`; e `UPDATE ... status='published', published_at=now(), scheduled_at=NULL` → fallimento (published richiede sia published_at che scheduled_at)
3. `UPDATE ... scheduled_at = approved_at - '1 minute'::interval` → fallimento CHECK `schedule_after_approve`

**`app/tests/invariants/content-draft-status-enum-extended.test.ts`** — 2 asserzioni:
4. `INSERT` con `status='scheduled'` + campi coerenti (approved_at, scheduled_at) riesce
5. `INSERT` con `status='published'` + campi coerenti riesce

**`app/tests/invariants/content-drafts-scheduled-tenant-scoping.test.ts`** — 2 asserzioni (pattern T11 + final IDOR):
6. Setup 2 org con brands e drafts scheduled distinti. `listScheduledByBrandBetween(brandOrgA, organizationOrgB, ...)` ritorna `[]`.
7. `listScheduledByBrandBetween(brandOrgA, organizationOrgA, ...)` ritorna N > 0 drafts.

**Totale nuovi test:** 3 file × 7 asserzioni.

### 7.2 Test boundaries

`m03-editorial-boundaries.test.ts` esistente cattura automaticamente eventuali violazioni RS-1 introdotte dai nuovi file (dep-cruiser + config `.dependency-cruiser.cjs` con `pathNot` già impostato per `m03-editorial/internal/`). Nessun test nuovo obbligatorio, ma verifichiamo che passi verde dopo aggiunta di actions/repo/UI.

### 7.3 Test UI

Nessuno obbligatorio in F1.5b-α (pattern F1.5a). Copertura via tour manuale.

### 7.4 Totale suite dopo F1.5b-α

**62 test** (era 55 dopo F1.5a). Delta: +7 asserzioni in 3 file.

---

## 8. Definition of done

- `cd app && npm run ci` verde: lint + format:check + typecheck + boundaries + migrazioni + tutti i 62 test.
- Push su `origin/feature/f1-5b-alpha-*` per ogni commit.
- GitHub Actions verde sull'ultimo push.
- Tour manuale end-to-end (12 step, riportati in §1 Deliverable) eseguibile e funzionante nel browser locale con Owner `admin@admin.com`.
- Diario `docs/diario.md` aggiornato con:
  - Voce "Adesso" riscritta (F1.5b-α chiuso, prossima decisione: F1.5b-β / F1.3 / F1.4)
  - Voce "Fatto" nuova per F1.5b-α con sintesi (colonne DB, migrazioni, server actions, calendario, dnd-kit, test)
- Nessun placeholder rimasto nel codice (TBD/TODO/FIXME).
- Nessun eslint-disable non giustificato.

---

## 9. Out-of-scope esplicito (garanzia YAGNI)

Queste cose **NON entrano in F1.5b-α** e restano segnate per cantieri successivi:

- **UI edit + test + rotate delle chiavi AI** (Anthropic, Voyage, e futuri provider) → **F1.6 configurazione runtime**. Include storage sicuro delle key (decisione Supabase Vault vs colonna encrypted), bottone "Test connessione", quote/scadenze, rotate policy. In F1.5b-α c'è solo card read-only per feedback immediato (§6.9).
- **Tetti di spesa configurabili in UI** (RF-11.5) → **F1.6** insieme al punto sopra.
- **Coda BullMQ + Redis** (RS-4, V-1 §9.2, RF-5.5) → **F1.5b-β**. Serve quando vogliamo scheduler worker autonomo che alla data programmata segni `published` (o chiami adapter M5). Richiede Redis (Upstash produzione, Docker locale).
- **Publish adapter per canale reale** (M5, RF-5.1) → **F1.5c**. Facebook/Instagram Graph API, WhatsApp Business, email SMTP, ecc. Richiede credenziali fornitori.
- **Vista sessione RF-3.6 guidata** — "Sessione di programmazione" dedicata che elenca approvati in attesa + suggerimenti orari + preview 14 gg → **F1.5c**.
- **Corsia veloce RF-3.4** (contenuto da dettatura vocale, pronto per tutti i canali in minuti) → **F1.5c/M4**.
- **Richiesta anticipata materiali RF-3.9** (foto mancanti richieste in pianificazione) → **M4**.
- **Misurazione RF-3.5 / M9** (link tracking, ROI, KPI per marchio) → **M9**.
- **Vista aggregata multi-marchio** (`/calendario` senza slug) → **F1.5c**.
- **Validazione fasce orarie per canale RF-5.6** (mai WhatsApp <9 o >21) → **M5**.
- **Trigger DB per transition monotonicity** (blocca rewind da `published`/`rejected` a livello DB) → aggiunta futura se emerge bypass reale.
- **Notifiche push RF-3.6 assenza titolare** → **M12/M11**.

---

## 10. Riferimenti capitolato (ID toccati)

**Funzionali:** RF-3.5 (workflow di stato — questo cantiere copre `scheduled` + `published`), RF-3.6 (parziale — la vista bisettimanale supporta il ritmo delle sessioni, ma la vista sessione guidata è F1.5c).

**Strutturali:** RS-1 (confini modulo), RS-3 (invarianti DB), RS-6 (framework canonico), RS-7 (no ottimizzazione speculativa), RS-8 (migrazioni versionate).

**Autonomia/permessi:** RA-8.5 (server actions tipizzate), RA-8.12 (audit obbligatorio), RU-1a (solo Owner).

**Naming/audit:** RN-87 (organization_id + requireOwnedDraft), RF-11.3 (audit event per ogni action).

**Qualità/processo:** RQ-1 (ID nei commit), RQ-7 (definition of done: strict + lint + test + CI + push).

**Osservabilità/config:** RNF-1 (nessun segreto nel repo — la card §6.9 mostra solo maschera parziale server-side, le chiavi vive restano in `.env.local` ignorato).

**Vincoli progetto:** V-1 (semplicità), V-2 (2 sessioni/settimana da 30 min — informa la vista bisettimanale).
