# F1.2 — M2 Brand kit editabile (design)

**Data:** 14 settembre 2026
**Fase capitolato:** F1 (Data Hub + brand kit + calendario editoriale + template + generazione contenuti + coda approvazioni) — sotto-cantiere F1.2, secondo dopo F1.1 (shell UI).
**Base:** branch `feature/f1-1-layout-shell` (F1.1 completo, ~45 commit) — nuovo branch `feature/f1-2-brand-kit`.
**Obiettivo:** rendere editabile per marchio il brand kit necessario alla generazione contenuti AI (tono di voce, contesto strategico, rubriche/pilastri, vincoli redazionali). Base per M3 piano editoriale.

---

## 1. Contesto e vincoli globali

**Cosa costruiamo:** editing UI + backend + schema DB per il **brand kit di ciascun marchio** che l'AI di M3 leggerà come contesto obbligatorio in ogni generazione (RF-2.3, RF-2.3a, RF-2.4, RF-2.5). In F1.2 focus sul contenuto testuale/semantico; upload logo e color picker sono rimandati a F1.5+.

**Vincoli globali (ereditati):**
- **RQ-1** Commit citano ID.
- **RQ-7** DoD: TS strict, lint, test invarianti, CI verde, campo pulito.
- **RS-1** Confini modulo verificati in CI (dep-cruiser). Nuovo modulo `m02-brand`.
- **RS-2** Dominio via adapter (`lib/db/*`), no SDK diretti.
- **RS-3** Invarianti in DB (unique, FK, check, RLS).
- **RS-6** Convenzionalità: shadcn/ui + Server Actions React 19 + `next/navigation`.
- **RS-8** Migrazioni versionate naming `YYYYMMDDNNNNNN_verbo_soggetto.sql`.
- **RN-87** `organization_id` non presente su brand_kits/pillars/forbidden/sensitive: derivato via FK a `brands` (che già ha organization_id).
- **RU-1a** Dati commerciali protetti: brand kit è configurazione contenuti (non commerciale), ma in F1.2 accesso limitato a Owner (permessi granulari Editor arrivano in F1.3).
- **RF-2.3** Tono di voce come contesto obbligatorio.
- **RF-2.3a** Contesto strategico (scopo/pubblico, obiettivo anno, direzione futura) obbligatorio.
- **RF-2.4** Rubriche e pilastri con pesi di frequenza.
- **RF-2.5** Vincoli redazionali (parole bandite, argomenti sensibili, claim vietati).
- **RF-2.6** Isolamento per marchio.

**Fuori scope F1.2:**
- Upload logo (RF-2.2 area sostituibile per Eni) → F1.5+
- Color picker per palette marchio → F1.5+
- Email identity SPF/DKIM (RF-2.2a) → M11 RF-11.2
- Editor Editor/delegate del brand kit (RU-1) → F1.3
- Anteprima live con AI (M3) → F1.5
- Reorder drag'n'drop pillars (per ora frecce su/giù)

---

## 2. Stack e dipendenze

**Nessuna nuova dep runtime.** Riuso al 100% F1.1:
- shadcn/ui: aggiungo `Textarea` (via `npx shadcn@latest add textarea` — non presente in F1.1)
- Server Actions React 19 nativi
- Palette + font già in `globals.css`

**Dep dev per test:** già presenti (`vitest`, `@testing-library/react`, `jsdom`, `dotenv-cli`).

---

## 3. Schema database

**4 nuove tabelle relazionali + 1 seed** (5 migrazioni). Naming `YYYYMMDDNNNNNN_*.sql` (14 cifre continue, convenzione F0 fix Task 5).

### `20260914000001_brand_kits.sql`

```sql
-- RF-2.3 (tono), RF-2.3a (contesto strategico).
-- 1:1 con brands. brand_id come primary key = FK cascade.
create table public.brand_kits (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  tone_of_voice text not null default '',
  strategic_purpose text not null default '',
  strategic_year_goal text not null default '',
  strategic_direction text not null default '',
  updated_at timestamptz not null default now(),
  constraint brand_kits_tone_len check (length(tone_of_voice) <= 5000),
  constraint brand_kits_purpose_len check (length(strategic_purpose) <= 3000),
  constraint brand_kits_year_goal_len check (length(strategic_year_goal) <= 3000),
  constraint brand_kits_direction_len check (length(strategic_direction) <= 3000)
);

alter table public.brand_kits enable row level security;
revoke insert, update, delete on public.brand_kits from anon, authenticated;
grant insert, update, delete, select on public.brand_kits to service_role;

comment on table public.brand_kits is
  'RF-2.3 + RF-2.3a: tono di voce + contesto strategico per marchio. 1:1 con brands.';
```

### `20260914000002_brand_pillars.sql`

```sql
-- RF-2.4: rubriche/pilastri con pesi frequenza per piano editoriale.
create table public.brand_pillars (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  weight integer not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint brand_pillars_name_per_brand_unique unique (brand_id, name),
  constraint brand_pillars_weight_range check (weight between 1 and 10),
  constraint brand_pillars_name_len check (length(name) between 1 and 100)
);

create index brand_pillars_brand_sort_idx on public.brand_pillars(brand_id, sort_order);

alter table public.brand_pillars enable row level security;
revoke insert, update, delete on public.brand_pillars from anon, authenticated;
grant insert, update, delete, select on public.brand_pillars to service_role;
```

### `20260914000003_brand_forbidden_words.sql`

```sql
-- RF-2.5: parole bandite per marchio (case-insensitive via lower(word) unique).
create table public.brand_forbidden_words (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  word text not null,
  created_at timestamptz not null default now(),
  constraint brand_forbidden_words_word_len check (length(word) between 1 and 100)
);

create unique index brand_forbidden_words_brand_lower_word_unique
  on public.brand_forbidden_words(brand_id, lower(word));

create index brand_forbidden_words_brand_idx on public.brand_forbidden_words(brand_id);

alter table public.brand_forbidden_words enable row level security;
revoke insert, update, delete on public.brand_forbidden_words from anon, authenticated;
grant insert, update, delete, select on public.brand_forbidden_words to service_role;
```

### `20260914000004_brand_sensitive_topics.sql`

```sql
-- RF-2.5: argomenti sensibili (claim vietati + argomenti che richiedono revisione umana).
create table public.brand_sensitive_topics (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  topic text not null,
  kind text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint brand_sensitive_topics_kind_check
    check (kind in ('claim_vietato', 'revisione_umana')),
  constraint brand_sensitive_topics_per_brand_unique unique (brand_id, topic, kind),
  constraint brand_sensitive_topics_topic_len check (length(topic) between 1 and 200),
  constraint brand_sensitive_topics_note_len check (length(note) <= 500)
);

create index brand_sensitive_topics_brand_idx on public.brand_sensitive_topics(brand_id);

alter table public.brand_sensitive_topics enable row level security;
revoke insert, update, delete on public.brand_sensitive_topics from anon, authenticated;
grant insert, update, delete, select on public.brand_sensitive_topics to service_role;
```

### `20260914000005_seed_initial_brand_kits.sql`

Seed dati iniziali dai contenuti del capitolato (§1.1 tono voce, §2, RN-33, RN-60, RN-78, §7.2 rubriche):

```sql
-- Lenny: tono "giovane, veloce, digitale" (§1.1)
insert into public.brand_kits (brand_id, tone_of_voice, strategic_purpose, strategic_year_goal, strategic_direction)
select b.id,
  'Giovane, veloce, digitale. Registro colloquiale, mai aziendalese. Parla il marchio Lenny, non il titolare in prima persona.',
  'Food delivery e spesa a domicilio su San Marino. Pubblico: residenti + pendolari (~30.000 nel bacino) come base di frequenza; turismo estivo come volano di acquisizione. Lenny è software house nata dal delivery, orientata a lanciare altri servizi.',
  'Aumentare la frequenza degli ordini per cliente esistente. Riattivare i dormienti. Alimentare Lenny nei mesi estivi con la stazione come raccolta contatti.',
  'Nei prossimi anni: aggiunta di nuovi servizi verticali sotto brand Lenny (partendo dalla spesa a domicilio) mantenendo il posizionamento di prodotto software leggero e riusabile.'
from public.brands b where b.slug = 'lenny'
on conflict (brand_id) do nothing;

-- Stazione: tono "quotidiano, affidabile, di territorio" (§1.1)
insert into public.brand_kits (brand_id, tone_of_voice, strategic_purpose, strategic_year_goal, strategic_direction)
select b.id,
  'Quotidiano, affidabile, di territorio. Voce dell''insegna storica di San Marino. Registro colloquiale, mai aziendalese. Il carburante non è oggetto di comunicazione ma dato.',
  'Stazione carburanti a marchio Eni sull''arteria principale di San Marino. Servizi attivi: carburante, lavaggi, shop. In apertura: bar (Eni Cafè) e officina. Forte quota di turismo italiano attratto dal differenziale prezzo del carburante.',
  'Notorietà presso i residenti e lancio dei nuovi servizi (bar, officina). Costruzione della base contatti da zero (nessun recapito in archivio).',
  'Trasformare il traffico esistente (già gratuito) in conversione verso gli altri servizi. Portare bar e officina a regime nei 12 mesi.'
from public.brands b where b.slug = 'stazione'
on conflict (brand_id) do nothing;

-- Eni Cafè: tono "conversazione da bar" (RN-33)
insert into public.brand_kits (brand_id, tone_of_voice, strategic_purpose, strategic_year_goal, strategic_direction)
select b.id,
  'Conversazione da bar. La decisione del cliente è quotidiana (caffè, aperitivo, colazione), il tono lo riflette. Chi cerca un aperitivo non cerca una stazione di servizio: voce autonoma, non "il bar della stazione".',
  'Il bar in apertura all''interno della stazione. Cadenza di comunicazione quotidiana (RN-34): il servizio genera più contenuti di tutti col minor sforzo (foto al banco, piatto del giorno, aperitivo).',
  'Farsi conoscere come luogo autonomo con carattere proprio. Costruire abitudini quotidiane su residenti e pendolari.',
  'Diventare punto di riferimento del centro. Espansione delle occasioni (colazione, pausa, aperitivo, pranzo veloce).'
from public.brands b where b.slug = 'eni-cafe'
on conflict (brand_id) do nothing;

-- Officina: tono "fiducia, non sconto" (RN-60, RN-78)
insert into public.brand_kits (brand_id, tone_of_voice, strategic_purpose, strategic_year_goal, strategic_direction)
select b.id,
  'Fiducia, competenza, presenza fisica costante. Mai sconti sulla tariffa oraria (RF-6.17): si vende con servizio incluso o controllo gratuito. L''officina, pur avendo nome proprio, mostra sempre di stare dentro la stazione (RN-60).',
  'Officina in apertura all''interno della stazione. Tagliandi, gomme, piccoli lavori. Prenotazione online, richiami automatici, preventivi come oggetto centrale del processo (RN-73).',
  'Priorità assoluta: le prime 5-6 recensioni Google (RN-61). Fiducia si costruisce con le prime esperienze positive. Orario continuato come argomento di vendita (RN-78).',
  'Diventare officina di riferimento del centro. Cross-selling verso lavaggi, shop, bar della stessa stazione.'
from public.brands b where b.slug = 'officina'
on conflict (brand_id) do nothing;

-- Seed pillars per Lenny (§7.2)
insert into public.brand_pillars (brand_id, name, weight, sort_order)
select b.id, unnest(array['Ristorante della settimana', 'Servizio (rete, zone, orari, spesa)', 'Commerciale', 'Dietro le quinte (rider e team)']),
       unnest(array[3, 3, 2, 2]),
       unnest(array[0, 1, 2, 3])
from public.brands b where b.slug = 'lenny'
on conflict (brand_id, name) do nothing;

-- Seed pillars per Stazione (§7.2)
insert into public.brand_pillars (brand_id, name, weight, sort_order)
select b.id, unnest(array['Servizio (orari, festività, chiusure)', 'I servizi con i volti di chi ci lavora', 'Consigli pratici stagionali', 'Commerciale']),
       unnest(array[4, 2, 2, 1]),
       unnest(array[0, 1, 2, 3])
from public.brands b where b.slug = 'stazione'
on conflict (brand_id, name) do nothing;

-- Seed pillars per Eni Cafè
insert into public.brand_pillars (brand_id, name, weight, sort_order)
select b.id, unnest(array['Piatto del giorno / offerta', 'Aperitivo', 'Volti del banco', 'Storie del bar']),
       unnest(array[4, 3, 2, 1]),
       unnest(array[0, 1, 2, 3])
from public.brands b where b.slug = 'eni-cafe'
on conflict (brand_id, name) do nothing;

-- Seed pillars per Officina
insert into public.brand_pillars (brand_id, name, weight, sort_order)
select b.id, unnest(array['Consigli stagionali (gomme, controlli)', 'Il meccanico spiega', 'Prenotazioni e disponibilità', 'Recensioni positive dei clienti']),
       unnest(array[3, 3, 2, 2]),
       unnest(array[0, 1, 2, 3])
from public.brands b where b.slug = 'officina'
on conflict (brand_id, name) do nothing;

-- Seed parole bandite universali (aziendalese) per tutti e 4 i marchi
insert into public.brand_forbidden_words (brand_id, word)
select b.id, unnest(array['eccellenza', 'sinergia', 'valore aggiunto', 'best-in-class', 'game changer'])
from public.brands b
on conflict do nothing;

-- Seed sensitive topics per Stazione: carburante (§13, §15.B)
insert into public.brand_sensitive_topics (brand_id, topic, kind, note)
select b.id, 'Nominare il prezzo del carburante nelle comunicazioni', 'revisione_umana',
       'Vincoli promozionali Eni ancora da chiarire (§15.B in carico al titolare). Sempre revisione umana prima di pubblicare.'
from public.brands b where b.slug = 'stazione'
on conflict (brand_id, topic, kind) do nothing;

-- Seed claim vietati per Lenny
insert into public.brand_sensitive_topics (brand_id, topic, kind, note)
select b.id, unnest(array['Sconti sul cibo a carico di Lenny', 'Promesse sui tempi di consegna specifici']),
       'claim_vietato',
       unnest(array['RF-6.16: erode la commissione, unica marginalità.', 'RF-7.6: dipendono dai ristoranti, non prometterli.'])
from public.brands b where b.slug = 'lenny'
on conflict (brand_id, topic, kind) do nothing;
```

**RS-3** rispettato: unique constraint, FK cascade, check, RLS denial-by-default, service_role only.

---

## 4. Modulo `m02-brand`

**Struttura:**
```
app/src/modules/m02-brand/
├── public.ts
├── README.md
└── internal/
    ├── brand-kit-types.ts       -- Tipi TS
    ├── brand-kit-repo.ts        -- Query DB + formatBrandContextForAI (helper M3 futuro)
    └── brand-kit-actions.ts     -- Server actions
```

**Interfaccia pubblica (`public.ts`):**

```ts
// Tipi
export type {
  BrandKit,
  BrandPillar,
  BrandForbiddenWord,
  BrandSensitiveTopic,
  BrandKitWithLists,
  SensitiveTopicKind,
} from "./internal/brand-kit-types";

// Query (server components)
export { getBrandKitWithLists } from "./internal/brand-kit-repo";

// Helper AI (usato da M3 in F1.5+)
export { formatBrandContextForAI } from "./internal/brand-kit-repo";

// Server actions (form submit)
export {
  updateBrandKitTone,
  updateBrandKitContext,
  addBrandPillar,
  updateBrandPillar,
  removeBrandPillar,
  moveBrandPillar,
  addBrandForbiddenWord,
  removeBrandForbiddenWord,
  addBrandSensitiveTopic,
  updateBrandSensitiveTopicNote,
  removeBrandSensitiveTopic,
} from "./internal/brand-kit-actions";
```

**Tipi (`brand-kit-types.ts`):**

```ts
export type SensitiveTopicKind = "claim_vietato" | "revisione_umana";

export type BrandKit = {
  brandId: string;
  toneOfVoice: string;
  strategicPurpose: string;
  strategicYearGoal: string;
  strategicDirection: string;
  updatedAt: string;
};

export type BrandPillar = {
  id: string;
  brandId: string;
  name: string;
  weight: number;
  sortOrder: number;
  createdAt: string;
};

export type BrandForbiddenWord = {
  id: string;
  brandId: string;
  word: string;
  createdAt: string;
};

export type BrandSensitiveTopic = {
  id: string;
  brandId: string;
  topic: string;
  kind: SensitiveTopicKind;
  note: string;
  createdAt: string;
};

export type BrandKitWithLists = {
  kit: BrandKit;
  pillars: BrandPillar[];
  forbiddenWords: BrandForbiddenWord[];
  sensitiveTopics: BrandSensitiveTopic[];
};
```

**Server actions:** ognuna:
1. Chiama `getSessionOrRedirect()`
2. Verifica `session.role === "owner"` — se no throw "Solo Owner può editare il brand kit (RU-1a)"
3. Valida input (lunghezze, kind enum, weight range)
4. Chiama `getAdminClient()` per query DB (service_role bypassa RLS by design)
5. Chiama `logAuditEvent()` (RF-11.3)
6. Chiama `revalidatePath('/marchi/[slug]', 'page')`
7. Ritorna void o throw

**`formatBrandContextForAI(brandId: string): Promise<string>`** — helper stub in F1.2, pronto per M3 in F1.5. Ritorna Markdown formattato:

```markdown
# Contesto di marca — {display_name}

## Tono di voce
{tone_of_voice}

## Contesto strategico
- **Scopo e pubblico:** {strategic_purpose}
- **Obiettivo dell'anno:** {strategic_year_goal}
- **Direzione futura:** {strategic_direction}

## Rubriche
- **{name}** (peso {weight})
- ...

## Parole bandite (mai usare)
{word}, {word}, ...

## Argomenti che richiedono attenzione
- **{topic}** ({kind}) — {note}
- ...
```

---

## 5. Routing + UI

**Route parametrica:** `app/src/app/(protected)/marchi/[slug]/page.tsx`

**Layout della pagina** (`marchi/[slug]/page.tsx`):

1. **Header** — link "← Torna ai marchi", chip marchio, titolo Fraunces "{display_name}"
2. **Card "Tono di voce"** — textarea (rows=8, max 5000 char), Save button
3. **Card "Contesto strategico"** (RF-2.3a) — 3 textarea + Save button unico che chiama `updateBrandKitContext(brandId, {purpose, year_goal, direction})`
4. **Card "Rubriche"** (RF-2.4) — tabella con colonne Nome / Peso / Ordine / Azioni (↑ ↓ 🗑) + form "Aggiungi rubrica" (nome + weight)
5. **Card "Parole bandite"** (RF-2.5) — chips con X + input "Aggiungi parola"
6. **Card "Argomenti sensibili"** (RF-2.5) — tabella con Argomento / Tipo (badge colorato) / Nota / 🗑 + form add (topic + select kind + optional note)
7. **Card "Anteprima contesto AI"** — readonly `<pre>` col Markdown formattato

**Modifiche a `/marchi` (Task 9 F1.1):** ogni riga della tabella diventa `<Link href={/marchi/${slug}}>` cliccabile. Aggiungo colonna "→" a destra. Il badge "Configurato · read-only in F1.1" viene sostituito da "**Clicca un marchio per editare** · brand kit editabile in F1.2".

**Role check:** in cima a `/marchi/[slug]/page.tsx`:
```ts
const session = await getSessionOrRedirect();
if (session.role !== "owner") notFound();
```

**Loading + error boundary:** `loading.tsx` con skeleton di 7 card + `error.tsx` client boundary con reset.

**Componenti UI riutilizzati (F1.1):** Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Badge, Table*, Select* (per kind sensitive topic), BrandChip.

**Nuovo componente shadcn:** Textarea (via CLI). Nessun altro.

**Nessun client component** oltre a `error.tsx`. Le server actions gestiscono tutto (form nativi HTML, submit → server action → revalidate).

---

## 6. Test invarianti

**4 nuovi file in `app/tests/invariants/`:**

### `brand-kit-scoping.test.ts`
- Insert brand_kit → OK
- Delete brand → verifica cascade su brand_kits, pillars, forbidden_words, sensitive_topics (tutti eliminati)

### `brand-kit-uniqueness.test.ts`
- 2 pillar stesso nome per stesso brand → errore unique
- 2 forbidden_word case-insensitive uguali (es. "Aziendalese" e "aziendalese") stesso brand → errore
- 2 sensitive_topic stesso topic+kind per stesso brand → errore
- 2 pillar stesso nome per brand DIVERSI → OK (unique è per brand_id)

### `brand-pillar-weight-range.test.ts`
- weight=0 → errore check
- weight=11 → errore
- weight=1 → OK
- weight=10 → OK

### `brand-sensitive-topic-kind.test.ts`
- kind='claim_vietato' → OK
- kind='revisione_umana' → OK
- kind='altro' → errore check

**Test totali dopo F1.2:** 16 (F1.1) + 4 nuovi × ~3 assertion = ~28 test invarianti.

**Nessun test UI** in F1.2 (no client component significativi).

**`npm run boundaries` cattura automaticamente m02-brand** — nessuna modifica a `.dependency-cruiser.cjs`.

---

## 7. CI + Definition of Done

**Locale (`npm run ci`):**
- 6 step invariati (lint, format:check, typecheck, boundaries, migrations, test)
- Dopo F1.2: 3 moduli (m11 + m12 + m02) sotto RS-1, 12 migrazioni (7 F0 + 5 F1.2), 28 test

**GitHub Actions:** invariato (setup F0-b). Ogni push su feature/f1-2-brand-kit triggera CI. Ogni PR verso main triggera CI.

**Definition of Done F1.2 complete:**
- 5 migrazioni applicate senza errori
- `npm run ci` locale verde
- GitHub Actions verde sul push finale
- Owner logga a `/marchi/lenny` e vede 7 card popolate con seed
- Owner modifica il tono di Lenny, salva, ricarica → il nuovo tono persiste
- Owner aggiunge una rubrica → riappare nella lista
- Owner cancella una parola bandita → sparisce
- L'anteprima contesto AI mostra il Markdown formattato aggiornato
- Editor (quando esisterà in F1.3) NON vede /marchi/[slug] → 404
- Diario aggiornato con voce "14 set 2026 — F1.2 completato"

---

## 8. Struttura file finale dopo F1.2

```
app/
├── supabase/migrations/
│   ├── 20260907000001..000007_*.sql       (F0, invariati)
│   ├── 20260914000001_brand_kits.sql       (NUOVO)
│   ├── 20260914000002_brand_pillars.sql    (NUOVO)
│   ├── 20260914000003_brand_forbidden_words.sql (NUOVO)
│   ├── 20260914000004_brand_sensitive_topics.sql (NUOVO)
│   └── 20260914000005_seed_initial_brand_kits.sql (NUOVO)
├── src/
│   ├── modules/
│   │   ├── m02-brand/                      (NUOVO intero modulo)
│   │   │   ├── public.ts
│   │   │   ├── README.md
│   │   │   └── internal/
│   │   │       ├── brand-kit-types.ts
│   │   │       ├── brand-kit-repo.ts
│   │   │       └── brand-kit-actions.ts
│   │   ├── m11-admin/                      (invariato)
│   │   └── m12-daily-use/                  (invariato)
│   ├── components/ui/
│   │   └── textarea.tsx                    (NUOVO — shadcn CLI)
│   └── app/(protected)/
│       └── marchi/
│           ├── page.tsx                    (MODIFICATO — righe diventano link)
│           ├── loading.tsx                 (invariato)
│           ├── error.tsx                   (invariato)
│           └── [slug]/                     (NUOVO)
│               ├── page.tsx                (Home marchio con 7 card)
│               ├── loading.tsx
│               └── error.tsx
└── tests/invariants/
    ├── brand-kit-scoping.test.ts           (NUOVO)
    ├── brand-kit-uniqueness.test.ts        (NUOVO)
    ├── brand-pillar-weight-range.test.ts   (NUOVO)
    └── brand-sensitive-topic-kind.test.ts  (NUOVO)
```

---

## 9. Cosa lascia in eredità a F1.5+

- **`formatBrandContextForAI(brandId)`** già in `public.ts` di m02-brand → M3 (generazione contenuti) lo consuma come contesto obbligatorio in ogni prompt (RF-2.3, RF-2.3a).
- **Schema brand_kits + pillars + forbidden_words + sensitive_topics** pronto per essere letto dai moduli AI (M3, M4).
- **Pattern editing per marchio** (`/[slug]` con card verticali) riusabile per M4 template, M6 configurazione voucher.
- **Test invarianti per FK cascade** — pattern per moduli futuri con relazioni 1:N per marchio.
- **3 moduli sotto RS-1** — conferma che il pattern scala.

---

*Spec F1.2 — 14 settembre 2026. Design approvato in brainstorming. Prossimo step: skill `writing-plans` per traduzione in piano implementativo.*
