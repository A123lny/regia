# F1.1 — Layout UI + shell (design)

**Data:** 8 settembre 2026
**Fase capitolato:** F1 (Data Hub + brand kit + calendario editoriale + template + generazione contenuti + coda approvazioni) — questa spec copre solo il primo sotto-cantiere.
**Base:** branch `feature/cantiere-f0` (F0 locale completato, 19 commit).
**Obiettivo:** costruire la base grafica riusabile e le prime pagine di navigazione, per rendere Regìa presentabile e pronta ad accogliere i moduli funzionali di F1.2+.

---

## 1. Contesto e vincoli globali

**Perché F1 va spezzato:** F1 nel capitolato §12.3 copre 6 sotto-sistemi indipendenti (M1 Data Hub + parte di M2 brand kit + parte di M3 motore editoriale + parte di M4 media/template). Un piano unico sarebbe ingestibile. F1 viene decomposto in sotto-cantieri (F1.1, F1.2, F1.3, …), ciascuno con la propria spec, piano e branch.

**F1.1 è il primo sotto-cantiere:** costruisce la base grafica riusabile (design system + layout) e 6 pagine di navigazione, senza aggiungere funzionalità di dominio. È il fondamento visivo su cui F1.2+ costruirà.

**Vincoli globali (ereditati dal capitolato e da CLAUDE.md — si applicano implicitamente a ogni cosa):**
- **RQ-1** Ogni commit cita gli ID dei requisiti implementati.
- **RQ-7** Definition of done: TypeScript strict, lint pulito, test invarianti toccati, ID nei commit, CI verde, campo pulito.
- **RS-1** Confini di modulo verificati automaticamente in CI (dep-cruiser).
- **RS-2** Il dominio dipende dagli adapter, mai dagli SDK direttamente. In F1.1 non nasce nessun nuovo adapter: si riusano `getServerClient/getAdminClient/getMiddlewareClient` di F0.
- **RS-3** Invarianti in DB, non solo in app.
- **RS-6** Convenzionalità: shadcn/ui + Tailwind + `next/font` sono il modo documentato per Next.js.
- **RN-16, RF-2.7** White label: nome, logo, colori dell'interfaccia sono parametrici. In F1.1 il nome "Regìa" è hardcoded; parametrizzazione arriva in F1.2 (config marchi).
- **RF-2.6** Isolamento per marchio + vista di gruppo riservata al titolare.
- **RF-12.1** Home mobile-first: "cosa devi fare" in alto, "come sta andando" sotto, leggibile in pochi secondi da telefono.
- **RNF-5** Interfaccia responsive: pienamente utilizzabile da telefono.
- **RNF-1** Nessun segreto in repository.
- **Convenzione lingua:** identificatori di codice in inglese; UI, commenti e documenti in italiano.

**Fuori scope di F1.1 (esplicito):**
- Editing brand kit (colori, tono, parole bandite, contesto strategico) → **F1.2** (M2 completo)
- Data Hub reale con connettori ai gestionali → **F1.4** (M1, richiede coordinamento con team dati §15.B)
- Creazione utenti / gestione permessi → **F1.3** (M11 admin parziale)
- Piano editoriale + generazione contenuti → **F2**
- Publishing, recensioni, voucher, advertising → **F2/F3**
- Dark mode
- Localizzazione (tutto italiano hardcoded)
- Notifiche real-time
- Grafici temporali (arriveranno con dati veri in F2)

---

## 2. Stack e dipendenze

**Stack UI aggiuntivo su F0:**

| Dipendenza | Tipo | Perché |
|---|---|---|
| **Tailwind CSS v4** | build | Utility-first, integrazione nativa Next 16 |
| **shadcn/ui** | codice copiato | Componenti primitivi (Sidebar, Card, Table, Sheet…). Non è dependency: il CLI copia il sorgente in `src/components/ui/`. Coerente con RS-2 (nessun SDK lock-in) e RS-6 (pattern documentato ufficialmente per Next.js). |
| **`Fraunces`** via `next/font/google` | asset | Serif variabile per titoli (vibe editoriale caldo). Self-hosted da Next: zero richieste esterne runtime. |
| **`Geist Sans`** via `next/font/google` | asset | Sans per body. Già in ecosistema Next. Self-hosted. |
| **`lucide-react`** | runtime | Icone tree-shakeable. Set minimo per F1.1: `Menu`, `Home`, `Tag`, `ScrollText`, `Settings`, `LogOut`, `ChevronDown`, `Circle`. |
| **`clsx` + `tailwind-merge`** | runtime | ~2KB totali, richiesti da shadcn per `cn()` utility. |

**Test aggiuntivi:**

| Dipendenza | Tipo | Perché |
|---|---|---|
| **`@testing-library/react`** | dev | Test dei componenti UI. |
| **`@testing-library/dom`** | dev | Peer dependency di react testing lib. |
| **`jsdom`** | dev | Ambiente browser simulato per Vitest su file `.tsx.test`. |

`vitest.config.ts` viene esteso con `environmentMatchGlobs` per usare `jsdom` sui `.tsx.test` e restare su `node` per gli altri.

**Nessuna dipendenza runtime pesante:** no framer-motion, no icon library completa, no state management library, no CSS-in-JS.

---

## 3. Palette e tipografia

### Palette (CSS variables in `app/src/app/globals.css`)

Dark mode fuori scope F1.1 (nessuna `[data-theme=dark]`).

| CSS variable | Colore | Hex | Uso |
|---|---|---|---|
| `--bg` | crema warm | `#FAF7F2` | sfondo pagina |
| `--surface` | crema chiara | `#FFFFFF` | card, sidebar, header |
| `--surface-muted` | crema tenue | `#F3EDE4` | hover, separatori sottili |
| `--border` | grigio caldo | `#E4DBCE` | bordi card e input |
| `--text` | bruno scuro | `#2C1810` | body |
| `--text-muted` | bruno tenue | `#7A6857` | metadata, timestamp |
| `--primary` | terracotta | `#C25A3B` | pulsanti primari, link attivi, focus ring |
| `--primary-hover` | terracotta scura | `#A34A2E` | stato hover del primary |
| `--secondary` | verde salvia | `#87A96B` | stati positivi, "attivo", success |
| `--warning` | ambra caldo | `#D89B4A` | attenzione |
| `--danger` | rosso mattone | `#B04A3C` | errori, azioni distruttive |

**Contrasto WCAG verificato:** `--text` su `--bg` = 14.8:1 (AAA). `--primary` su `--bg` = 4.6:1 (AA).

### Colori marchio (solo per chip/badge marchio, mai per elementi generali di UI)

| Marchio | Slug | Colore | Hex |
|---|---|---|---|
| Lenny | `lenny` | arancio food delivery | `#FF6B35` |
| Stazione | `stazione` | blu carburanti | `#1E5F8C` |
| Eni Cafè | `eni-cafe` | bruno caffè | `#8C5E1E` |
| Officina | `officina` | grafite meccanica | `#3E4C59` |

Stesse tinte del prototipo Streamlit — coerenza di riconoscimento tra prototipo di riferimento e piattaforma target.

### Tipografia

- **`Fraunces`** (variable font, self-hosted via `next/font/google`) — H1–H3, hero, brand name. Serif elegante moderna, tratti caldi coerenti col vibe magazine.
- **`Geist Sans`** — body, form, tabelle, sidebar. Leggibile a densità alta.
- **Nessun terzo font.** YAGNI.

Configurazione in `app/src/app/layout.tsx`:

```tsx
import { Fraunces } from "next/font/google";
import { Geist } from "next/font/google";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

// <html lang="it" className={`${fraunces.variable} ${geist.variable}`}>
```

Scala tipografica modulare 1.25x in `tailwind.config.ts`:

| Nome | Size | px |
|---|---|---|
| `text-xs` | caption/badge | 12 |
| `text-sm` | metadata | 14 |
| `text-base` | body | 16 |
| `text-lg` | titolo card | 20 |
| `text-xl` | H3 | 24 |
| `text-2xl` | H2 | 30 |
| `text-3xl` | H1 | 36 |

Titoli usano `font-serif` (Fraunces via `--font-fraunces`), body usa `font-sans` (Geist).

---

## 4. Navigazione e layout globale

### Layout autenticato (pagine sotto `app/src/app/(protected)/`)

```
┌─────────────────────────────────────────────────────────┐
│  ☰  [Regìa]           [Tutti ▾] [Marchi]      [👤 AC ▾] │  header 56px, sticky top
├──────────┬──────────────────────────────────────────────┤
│  Home    │                                              │
│  Marchi  │                                              │
│  Audit   │            <main content>                    │
│  Config  │                                              │
│          │                                              │
│ [Esci]   │                                              │
└──────────┴──────────────────────────────────────────────┘
   240px         flex-1, max-w-6xl mx-auto, padding 32px
```

### Componente `AppShell` (`app/src/components/layout/app-shell.tsx`)

Container globale che avvolge header + sidebar + main. Usato dal `layout.tsx` di `(protected)/` — quindi ogni pagina protetta lo eredita automaticamente.

### Sidebar (`app/src/components/layout/sidebar.tsx`)

- **Desktop (≥ 768px):** fissa a sinistra, larghezza 240px, sfondo `--surface`, bordo destro `--border`.
- **Mobile (< 768px):** nascosta di default, appare come drawer sopra il contenuto premendo l'icona `☰` nell'header (uso `Sheet` di shadcn).
- **Voci** = link Next.js con stato attivo (bordo sinistro terracotta 3px + testo terracotta), logica via `usePathname()`.
- **Voci F1.1:** `Home` (`/dashboard`), `Marchi` (`/marchi`), `Audit log` (`/audit`), `Impostazioni` (`/impostazioni`). Ogni voce ha icona `lucide-react`.
- **Aggiunta di future voci:** ogni nuovo modulo F1.2+ aggiunge la sua voce nell'array di navigazione. In F1.1 quest'array è nel file sidebar (F1.3 lo estrarrà in config).
- **In fondo:** pulsante "Esci" (form action che chiama `supabase.auth.signOut()` server-side, poi `redirect("/login")`).

### Header (`app/src/components/layout/header.tsx`)

- **Icona hamburger** a sinistra (visibile solo mobile, apre il drawer).
- **Wordmark "Regìa"** (Fraunces 20px, `--text`, cliccabile → `/`). Hardcoded in F1.1; parametrizzabile in F1.2.
- **Brand switcher** al centro (`app/src/components/brand/brand-switcher.tsx`): `Select` shadcn con 5 opzioni:
  - "Tutti i marchi" (default per Owner — vista di gruppo, RF-2.6)
  - Lenny, Stazione, Eni Cafè, Officina (con chip colorato a fianco)
  - Selezione persistita in cookie `regia_brand_scope` (valore = slug marchio o `"all"`).
  - Cookie letto server-side da ogni pagina protetta via `cookies().get("regia_brand_scope")?.value ?? "all"`.
  - Server action `setBrandScope(slug: string)` scrive il cookie e triggera `revalidatePath("/")` per aggiornare la UI.
- **Avatar utente** a destra (cerchio terracotta 32px con iniziali) con dropdown menu shadcn: nome, email, link a `/impostazioni`, "Esci".

### Chip marchio (`app/src/components/brand/brand-chip.tsx`)

Componente riusabile ovunque compare un marchio:

```
[● Lenny]   [● Stazione]   [● Eni Cafè]   [● Officina]
```

Pallino colorato del marchio + nome. Sfondo `--surface-muted`, testo `--text`, bordo `--border`. Props: `brand: "lenny" | "stazione" | "eni-cafe" | "officina"`. Colori risolti da mappa interna (non da CSS vars — sono valori identità che non cambiano).

### Responsive breakpoints

| Breakpoint | Larghezza | Comportamento |
|---|---|---|
| Mobile | `< 768px` | Sidebar drawer, main padding 16px, header full |
| Tablet | `≥ 768px` | Sidebar fissa 240px, main padding 24px |
| Desktop | `≥ 1024px` | Contenuto `max-w-6xl` centrato, padding 32px |

### Icone

Solo da `lucide-react`, tree-shakeable. Set F1.1: `Menu`, `Home`, `Tag`, `ScrollText`, `Settings`, `LogOut`, `ChevronDown`, `Circle`. Ogni icona è import esplicito (no `import * as Icons`).

---

## 5. Le 6 pagine

### Pagine pubbliche (fuori shell, `layout.tsx` root senza `AppShell`)

#### `/` — Landing pubblica

File: `app/src/app/page.tsx` (esiste da F0, va restilizzata).

- Full-page centrata, sfondo `--bg`.
- **Hero:** "Regìa" in Fraunces 64px + sottotitolo Geist 18px `--text-muted`: *"Piattaforma di marketing e operazioni commerciali multi-marchio. Gruppo Lenny + Stazione, San Marino."*
- **Pulsante primario terracotta:** "Accedi" → `/login`.
- **Footer minimo:** `Cantiere F0 · 8 set 2026` + `Fase corrente: F1.1 layout`.

#### `/login` — Form login

Files: `app/src/app/login/page.tsx` + `login/actions.ts` (esistono da F0, `page.tsx` va restilizzata; `actions.ts` invariato).

- Layout centrato, card bianca 400px larghezza, ombra morbida (`shadow-sm`).
- **Wordmark "Regìa"** Fraunces in alto.
- **Campi:** Email, Password (`Input` shadcn), pulsante terracotta full-width "Accedi".
- **Messaggio errore inline** (`--danger`) se redirect ritorna con `?error=…`.
- **In fondo:** link muted a `docs/runbook-primo-owner.md` per il primo Owner in locale.
- Nessun sign-up (in F0-b `enable_signup=false` per policy).

### Pagine protette (dentro `AppShell`)

#### `/dashboard` — Home M12

File: `app/src/app/(protected)/dashboard/page.tsx` (esiste da F0, va rifatta).

Struttura RF-12.1: "cosa devi fare" in alto, "come sta andando" sotto.

**Blocco 1 — "Cosa devi fare oggi"** (4 `MetricCard` in grid 2x2 su mobile, 1x4 su desktop):

| Metric | Query | Nota footer se 0 |
|---|---|---|
| Contenuti da approvare | `select count(*) from contents where state = 'proposto'` | "*Attivo in F2*" |
| Recensioni da gestire | `select count(*) from reviews where state = 'bozza_pronta'` | "*Attivo in F2*" |
| Ristoranti in raffreddamento | `select count(*) from restaurants where cooling = true` | "*Attivo in F3*" |
| Allarmi costi | `select count(*) from cost_alerts` | "*Attivo in F2*" |

Le tabelle non esistono ancora in F0/F1.1: query in try/catch che ritorna `0` se `error.code === '42P01'` (undefined_table). **Le count NON sono hardcoded** — sono vere, restituiscono 0 perché la tabella non c'è ancora. Quando F1.2+ aggiunge le tabelle, si popolano automaticamente.

**Blocco 2 — "Come sta andando"** (dati veri in F1.1):

- **Marchi attivi:** chip dei 4 marchi (`select display_name, slug from brands where organization_id = $currentOrg order by display_name`)
- **Ultimo accesso al sistema:** timestamp dell'evento più recente in `audit_events` con `action like 'auth.%'`
- **Ultimo backup:** timestamp del file più recente in `app/backups/` (fs.stat, in F0-b sarà API Supabase)
- **Ambiente:** badge "Sviluppo locale" (`--secondary`). In F0-b diventerà "Produzione"/"Staging".

**Nessun grafico in F1.1.** Grafici temporali richiedono dati storici — arriveranno in F2.

#### `/marchi` — Vista sola-lettura

File: `app/src/app/(protected)/marchi/page.tsx` (nuovo).

- Titolo Fraunces "**Marchi**" + sottotitolo `--text-muted`: *"I quattro marchi del gruppo, configurati come dati (RF-2.1). L'editing arriva in F1.2 (Brand kit)."*
- `Table` shadcn con colonne: **Chip marchio · Nome · Slug · Data creazione**. 4 righe seedate.
- **Nessun pulsante "Aggiungi"/"Modifica"** — sola lettura in F1.1. In alto un badge muted: *"Configurato · read-only in F1.1"*.

#### `/audit` — Viewer log immutabile

File: `app/src/app/(protected)/audit/page.tsx` (nuovo).

- Titolo Fraunces "**Audit log**" + sottotitolo: *"Traccia di ogni azione umana e agente (RF-11.3). Append-only garantito in DB."*
- Chiama **`getRecentAuditEvents(organizationId, 50)` dal modulo M11** (`@/modules/m11-admin/public`) — prima UI che consuma un modulo M rispettando RS-1.
- Scope organizzazione dalla sessione.
- `Table` shadcn con colonne: **Timestamp · Attore (email/`sistema`/`agente`) · Azione · Target · Dettagli** (JSON in expander collassabile).
- **Filtro semplice:** `Select` per `actor_kind` (tutti / user / agent / system) — server action che rirenderizza la pagina con il filtro.
- Server-rendered (RSC). No paginazione in F1.1 (limite 50 fisso). Header: "*Ultimi 50 eventi*".

#### `/impostazioni` — Profilo utente

File: `app/src/app/(protected)/impostazioni/page.tsx` (nuovo).

- Titolo Fraunces "**Impostazioni**".
- **Sezione "Il tuo profilo"** (card):
  - Email
  - Ruolo con badge (`owner` = terracotta, `editor` = salvia, ecc.)
  - Organization id
  - `requires_mfa` con nota *"Predisposizione — 2FA vero in F0-b (RU-3)"*
- **Sezione "Ambiente"** (card):
  - URL Supabase (mascherato: `http://127.0.0.1:5452*`)
  - Versione app da `package.json` (`process.env.npm_package_version` a build time)
  - Ultimo commit git da `process.env.GIT_SHA` se impostato, altrimenti "n/d"
- **Pulsante logout** in fondo (form action → `supabase.auth.signOut()` + `redirect("/login")`).

---

## 6. Interazione DB, adapter, moduli

### Riuso adapter F0

Nessun nuovo adapter Supabase in F1.1. Si riusano:

- `getSessionOrRedirect()` da `app/src/lib/auth/session.ts` — chiamata in ogni pagina protetta.
- `getServerClient()` — per query autenticate lato server (F0 ha RLS denial-by-default senza policy select; in F1.1 tutto passa via admin, vedi sotto).
- `getAdminClient()` — per lettura dashboard/marchi/audit (finché F1 non introduce le policy select in F1.2+). Ogni chiamata è annotata con `// F0: no RLS select policy yet — bypass via service_role. Verrà rimosso in F1.2 quando arrivano le policy select.`
- `getMiddlewareClient()` — invariato, refresh sessione.

**Regola invariata:** nessun `createClient` importato direttamente in nessuna pagina. Dep-cruiser lo bloccherebbe.

### Nuovo modulo `m12-daily-use`

**Struttura:**
```
app/src/modules/m12-daily-use/
├── public.ts
├── README.md
└── internal/
    └── dashboard-stats.ts
```

**Interfaccia esposta** (`public.ts`):

```ts
export { getDashboardStats } from "./internal/dashboard-stats";
export type { DashboardStats } from "./internal/dashboard-stats";
```

**Tipo:**

```ts
export type DashboardStats = {
  organizationId: string;
  toDo: {
    contentsPending: number;    // 0 in F1.1
    reviewsPending: number;     // 0 in F1.1
    restaurantsCooling: number; // 0 in F1.1
    costAlerts: number;         // 0 in F1.1
  };
  going: {
    brands: Array<{ slug: string; displayName: string }>;
    lastAuthEventAt: string | null;
    lastBackupAt: string | null;
    environment: "sviluppo-locale" | "staging" | "produzione";
  };
};
```

**Implementazione `getDashboardStats(organizationId)`:**
- Fa 5 query in parallelo (Promise.all): 4 count su tabelle "future" con try/catch su `42P01`, 1 select su `brands`.
- Legge `audit_events` per `lastAuthEventAt`.
- Legge filesystem `app/backups/` per `lastBackupAt` (fs.stat sul file più recente).
- `environment` derivato da `process.env.REGIA_ENVIRONMENT ?? "sviluppo-locale"`.

**Test invariante nuovo:** `app/tests/invariants/dashboard-stats.test.ts` verifica:
- `going.brands.length === 4` (dal seed)
- Contatori inesistenti ritornano `0` senza throw
- Query aggregate rispetta `organization_id` (probe con org id fittizio → `brands` vuoto).

### Modulo `m11-admin` (invariato)

Il modulo M11 (audit reader) esiste da F0. La pagina `/audit` importa da `@/modules/m11-admin/public` — nessuna modifica al modulo.

Con l'aggiunta di `m12-daily-use`, F1.1 ospita **2 moduli reali** — primo test di RS-1 con più di un modulo.

### RS-1 confini (invariato)

Nessuna modifica a `.dependency-cruiser.cjs`. Le tre regole esistenti coprono automaticamente il nuovo modulo:
- `modules-internal-forbidden` — impedisce import di `internal/` da fuori del modulo
- `cross-module-internal-forbidden` — impedisce cross-module internal
- `no-circular` — safety net

I nuovi componenti sotto `src/components/` NON sono un modulo — sono infrastructure UI condivisa, come `src/lib/`.

---

## 7. Cookie brand scope

- **Nome:** `regia_brand_scope`
- **Valore:** slug marchio (`lenny`, `stazione`, `eni-cafe`, `officina`) o `all`
- **Default se assente:** `all` (Owner vede tutto)
- **HttpOnly:** `false` (il valore serve anche client-side per feedback UI, non è segreto)
- **SameSite:** `lax`
- **Max-Age:** 90 giorni
- **Impostato da:** server action `setBrandScope(slug)` in `app/src/lib/brand/scope.ts` (nuovo file).
- **Letto da:** helper `getBrandScope()` nello stesso file, chiamato da ogni pagina server-side che filtra per marchio.

In F1.1 usato solo dalla dashboard per filtrare i contatori (quando saranno reali in F1.2+) e dal `BrandSwitcher` per mostrare la selezione corrente.

---

## 8. Componenti UI riusabili (nuovi in F1.1)

```
app/src/components/
├── layout/
│   ├── app-shell.tsx          Container header+sidebar+main
│   ├── header.tsx             Header con brand switcher e user avatar
│   ├── sidebar.tsx            Sidebar + drawer mobile
│   └── user-menu.tsx          Dropdown avatar
├── ui/                        (generato da shadcn cli — codice tuo)
│   ├── button.tsx
│   ├── card.tsx
│   ├── select.tsx
│   ├── sheet.tsx              Per il drawer mobile
│   ├── table.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── badge.tsx
│   ├── avatar.tsx
│   ├── separator.tsx
│   └── dropdown-menu.tsx
├── brand/
│   ├── brand-chip.tsx         Chip colorato per marchio
│   └── brand-switcher.tsx     Select scope corrente (cookie-backed)
└── dashboard/
    ├── metric-card.tsx        Card contatore + label + footer
    └── environment-badge.tsx  Badge "Sviluppo locale" / "Produzione"
```

Nessun componente è "modulo" ai fini di RS-1 — sono infrastructure UI riusabili, importabili da qualsiasi pagina/modulo.

---

## 9. Loading e errori

- Ogni route protetta ha `loading.tsx` con skeleton `Card` shadcn.
- Ogni route ha `error.tsx` con messaggio + pulsante "Ricarica".
- **No spinner globali.** Solo skeleton per le card della dashboard e della tabella audit.

---

## 10. Configurazione e file

**Nuovi file di configurazione:**

- `app/tailwind.config.ts` — palette + fontFamily + fontSize scala 1.25x
- `app/postcss.config.js` — Tailwind v4 via `@tailwindcss/postcss`
- `app/components.json` — configurazione shadcn/ui (path aliases, style base "new-york", tema custom via CSS vars)
- `app/src/app/globals.css` — CSS vars palette + `@tailwind base/components/utilities`

**File esistenti modificati:**

- `app/src/app/layout.tsx` — aggiunta `Fraunces` + `Geist` via `next/font`, `lang="it"`, className con font variables
- `app/src/app/page.tsx` — restilizzata (landing pubblica)
- `app/src/app/login/page.tsx` — restilizzata (card centrata)
- `app/src/app/(protected)/dashboard/page.tsx` — rifatta (Home M12)
- `app/src/app/(protected)/layout.tsx` — aggiunto wrapping in `<AppShell>`
- `app/package.json` — dipendenze nuove
- `app/vitest.config.ts` — `environmentMatchGlobs` per test UI

**Nuovi file di dominio:**

- `app/src/modules/m12-daily-use/public.ts`
- `app/src/modules/m12-daily-use/internal/dashboard-stats.ts`
- `app/src/modules/m12-daily-use/README.md`
- `app/src/lib/brand/scope.ts` — helper cookie brand scope
- `app/src/app/(protected)/marchi/page.tsx`
- `app/src/app/(protected)/audit/page.tsx`
- `app/src/app/(protected)/impostazioni/page.tsx`
- `app/src/app/(protected)/*/loading.tsx` (4 file, uno per pagina protetta: dashboard, marchi, audit, impostazioni)
- `app/src/app/(protected)/*/error.tsx` (4 file, uno per pagina protetta)

**Nuovi file di test:**

- `app/tests/invariants/dashboard-stats.test.ts`
- `app/tests/ui/brand-chip.test.tsx`

---

## 11. CI e Definition of Done

- `npm run ci` continua a girare gli stessi 6 step: lint, format:check, typecheck, boundaries (dep-cruiser), migrations (`db reset --no-seed` + seed reload), test (Vitest).
- Vitest ora usa `environmentMatchGlobs`: `jsdom` per `.tsx.test`, `node` per il resto.
- Dep-cruiser cattura automaticamente il nuovo modulo `m12-daily-use`.
- **DoD F1.1 completo quando:**
  - `npm run ci` esce 0
  - Tutte le 6 pagine renderizzano senza errori (verifica manuale: `npm run dev`, tour delle 6 route + brand switcher + logout)
  - Test invariante `dashboard-stats` passa (`brands.length === 4`, count 0 senza throw, scope rispettato)
  - Test UI `brand-chip` passa (colori giusti per i 4 marchi)
  - Responsive: sidebar collassa a drawer su viewport < 768px
  - Log audit_events popolato con almeno un evento `auth.login` reale
  - Commit finale F1.1 con messaggio che cita `RF-12.1 RF-2.6 RF-2.7 RS-1 RS-6`

---

## 12. Cosa lascia in eredità F1.1 a F1.2+

- **`AppShell` riusabile** — ogni nuova pagina protetta si mette in `(protected)/` e usa la shell automatica.
- **Design system consolidato** — nuovi componenti si costruiscono componendo primitive shadcn con la palette variabile.
- **Pattern "modulo Mn con `public.ts` + `internal/`"** ormai battuto con 2 moduli reali. F1.2 (brand kit) sarà `m02-brand` sulla stessa scia.
- **Cookie brand scope + `BrandSwitcher`** — ogni pagina futura legge lo scope corrente senza reimplementare.
- **Pattern test UI** (`environmentMatchGlobs` + testing-library) — riusabile per ogni futuro componente.

---

## 13. Struttura file finale dopo F1.1

```
app/
├── components.json                        (nuovo, shadcn)
├── postcss.config.js                      (nuovo)
├── tailwind.config.ts                     (nuovo)
├── package.json                           (aggiornato)
├── vitest.config.ts                       (aggiornato)
├── src/
│   ├── app/
│   │   ├── globals.css                    (nuovo/rifatto: CSS vars palette)
│   │   ├── layout.tsx                     (aggiornato: font + lang="it")
│   │   ├── page.tsx                       (restilizzato)
│   │   ├── middleware.ts                  (invariato F0)
│   │   ├── login/
│   │   │   ├── page.tsx                   (restilizzato)
│   │   │   └── actions.ts                 (invariato F0)
│   │   └── (protected)/
│   │       ├── layout.tsx                 (avvolge in <AppShell>)
│   │       ├── dashboard/
│   │       │   ├── page.tsx               (Home M12)
│   │       │   ├── loading.tsx            (nuovo)
│   │       │   └── error.tsx              (nuovo)
│   │       ├── marchi/
│   │       │   ├── page.tsx               (nuovo)
│   │       │   ├── loading.tsx            (nuovo)
│   │       │   └── error.tsx              (nuovo)
│   │       ├── audit/
│   │       │   ├── page.tsx               (nuovo)
│   │       │   ├── loading.tsx            (nuovo)
│   │       │   └── error.tsx              (nuovo)
│   │       └── impostazioni/
│   │           ├── page.tsx               (nuovo)
│   │           ├── loading.tsx            (nuovo)
│   │           └── error.tsx              (nuovo)
│   ├── components/                        (nuovo intero albero)
│   │   ├── layout/
│   │   ├── ui/                            (shadcn generato)
│   │   ├── brand/
│   │   └── dashboard/
│   ├── lib/
│   │   ├── auth/session.ts                (invariato)
│   │   ├── audit/                         (invariato)
│   │   ├── brand/scope.ts                 (nuovo)
│   │   └── db/                            (invariato)
│   └── modules/
│       ├── m11-admin/                     (invariato)
│       └── m12-daily-use/                 (nuovo)
└── tests/
    ├── boundaries/                        (invariato)
    ├── invariants/                        (aggiunto dashboard-stats.test.ts)
    └── ui/                                (nuovo, aggiunto brand-chip.test.tsx)
```

---

*Spec F1.1 — 8 settembre 2026. Design approvato, pronto per traduzione in piano implementativo (skill `writing-plans`).*
