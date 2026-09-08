# F1.1 — Layout UI + shell (Implementation Plan)

> **Per agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (raccomandato) per eseguire il piano task-per-task. Step usano `- [ ]` per il tracciamento.

**Goal:** costruire la base grafica riusabile e le prime 6 pagine di navigazione di Regìa, per renderla presentabile e pronta ad accogliere i moduli funzionali di F1.2+.

**Architettura:** shadcn/ui + Tailwind v4 + Fraunces/Geist + palette editoriale calda. `AppShell` (header + sidebar + main) avvolge tutte le pagine sotto `(protected)/`. Nuovo modulo `m12-daily-use` per aggregare i dati della dashboard. 2 moduli reali totali (m11-admin + m12-daily-use) — primo test vero di RS-1 con >1 modulo.

**Tech stack:**
- Framework: Next.js 16.3.4 + React 19.2.8 (già presenti da F0)
- Styling: Tailwind CSS v4 + shadcn/ui (codice copiato, non dependency)
- Font: `Fraunces` (titoli serif) + `Geist Sans` (body) via `next/font/google`
- Icone: `lucide-react` (set minimo: 8 icone)
- Test UI: `@testing-library/react` + `jsdom` (Vitest già installato)
- DB: riuso adapter F0 (`getServerClient`, `getAdminClient`) — nessun nuovo adapter

## Global Constraints

Dal capitolato v1.5 e dalla spec F1.1:

- **RQ-1** Ogni commit cita ID requisiti implementati (formato: `<IDs>: <descrizione italiana>`).
- **RQ-7** Definition of done: TypeScript strict, lint pulito, test invarianti toccati, CI verde (`npm run ci` exit 0), regola del campo pulito.
- **RS-1** Confini modulo verificati automaticamente in CI (dep-cruiser). `src/modules/*/internal/` non importabile da fuori.
- **RS-2** Dominio dipende dagli adapter, mai dagli SDK. Nessun `createClient` di Supabase importato fuori da `src/lib/db/`.
- **RS-3** Invarianti in DB (query dashboard aggregata è read-only, ma test rispetta scope organization_id).
- **RS-6** Convenzionalità: shadcn/ui + Tailwind + `next/font` nel modo documentato ufficialmente.
- **RN-16, RF-2.7** White label: nome "Regìa" hardcoded in F1.1 (parametrizzazione in F1.2).
- **RF-2.6** Isolamento per marchio + vista di gruppo. Cookie `regia_brand_scope` con default `all`.
- **RF-12.1** Home mobile-first: "cosa devi fare" in alto, "come sta andando" sotto.
- **RNF-5** Interfaccia responsive: pienamente utilizzabile da telefono.
- **RNF-1** Nessun segreto in repo (`.env.local` già gitignored).
- **Lingua:** identificatori codice in inglese; UI/commenti/docs in italiano.
- **Palette:** 11 CSS vars in `globals.css` (crema, terracotta, salvia) + 4 colori marchio (Lenny #FF6B35, Stazione #1E5F8C, Eni Cafè #8C5E1E, Officina #3E4C59) SOLO per chip marchio.
- **Fuori scope F1.1:** editing brand kit (F1.2), utenti/permessi (F1.3), Data Hub reale (F1.4), publishing (F2), voucher (F3), dark mode, i18n, grafici temporali.

---

## Struttura file finale dopo F1.1

```
app/
├── components.json                        (nuovo, shadcn)
├── postcss.config.js                      (nuovo)
├── tailwind.config.ts                     (nuovo)
├── package.json                           (aggiornato: nuove deps)
├── vitest.config.ts                       (aggiornato: environmentMatchGlobs)
├── src/
│   ├── app/
│   │   ├── globals.css                    (rifatto: CSS vars palette + Tailwind directives)
│   │   ├── layout.tsx                     (aggiornato: font + lang="it")
│   │   ├── page.tsx                       (restilizzata: landing pubblica)
│   │   ├── middleware.ts                  (invariato F0)
│   │   ├── login/
│   │   │   ├── page.tsx                   (restilizzata)
│   │   │   └── actions.ts                 (invariato F0)
│   │   └── (protected)/
│   │       ├── layout.tsx                 (avvolge in <AppShell>)
│   │       ├── dashboard/
│   │       │   ├── page.tsx               (Home M12)
│   │       │   ├── loading.tsx            (nuovo)
│   │       │   └── error.tsx              (nuovo)
│   │       ├── marchi/
│   │       │   ├── page.tsx               (nuovo, RO)
│   │       │   ├── loading.tsx            (nuovo)
│   │       │   └── error.tsx              (nuovo)
│   │       ├── audit/
│   │       │   ├── page.tsx               (nuovo, consuma M11)
│   │       │   ├── loading.tsx            (nuovo)
│   │       │   └── error.tsx              (nuovo)
│   │       └── impostazioni/
│   │           ├── page.tsx               (nuovo)
│   │           ├── loading.tsx            (nuovo)
│   │           └── error.tsx              (nuovo)
│   ├── components/                        (nuovo intero albero)
│   │   ├── layout/
│   │   │   ├── app-shell.tsx
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── user-menu.tsx
│   │   ├── ui/                            (shadcn generato, 12 componenti)
│   │   ├── brand/
│   │   │   ├── brand-chip.tsx
│   │   │   └── brand-switcher.tsx
│   │   └── dashboard/
│   │       ├── metric-card.tsx
│   │       └── environment-badge.tsx
│   ├── lib/
│   │   ├── auth/                          (invariato)
│   │   ├── audit/                         (invariato)
│   │   ├── brand/
│   │   │   └── scope.ts                   (nuovo: cookie helper)
│   │   └── db/                            (invariato)
│   └── modules/
│       ├── m11-admin/                     (invariato)
│       └── m12-daily-use/                 (nuovo)
│           ├── public.ts
│           ├── README.md
│           └── internal/
│               └── dashboard-stats.ts
└── tests/
    ├── boundaries/                        (invariato)
    ├── invariants/
    │   ├── audit-append-only.test.ts      (invariato)
    │   ├── brand-uniqueness.test.ts       (invariato)
    │   ├── organization-scoping.test.ts   (invariato)
    │   └── dashboard-stats.test.ts        (nuovo)
    └── ui/                                (nuovo)
        └── brand-chip.test.tsx            (nuovo)
```

---

## Task 1 — Tailwind v4 + palette CSS vars + font Fraunces/Geist

**Files:**
- Create: `app/postcss.config.js`, `app/tailwind.config.ts`
- Modify: `app/src/app/globals.css` (rifatto interamente), `app/src/app/layout.tsx`, `app/package.json`

**Interfaces:**
- Consuma: struttura F0 di `app/src/app/layout.tsx` (già presente, con `lang="en"` e senza font custom)
- Produce: classi Tailwind disponibili, CSS vars `--bg/--surface/--surface-muted/--border/--text/--text-muted/--primary/--primary-hover/--secondary/--warning/--danger`, font vars `--font-fraunces` e `--font-geist` accessibili globalmente

- [ ] **Step 1: Installa Tailwind v4 + PostCSS**

```bash
cd app
npm install --save-dev tailwindcss @tailwindcss/postcss
```

- [ ] **Step 2: Crea `app/postcss.config.js`**

```js
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 3: Crea `app/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-muted": "var(--surface-muted)",
        border: "var(--border)",
        text: "var(--text)",
        "text-muted": "var(--text-muted)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
        },
        secondary: "var(--secondary)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.25rem", { lineHeight: "1.75rem" }],
        xl: ["1.5rem", { lineHeight: "2rem" }],
        "2xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "3xl": ["2.25rem", { lineHeight: "2.5rem" }],
      },
    },
  },
};

export default config;
```

- [ ] **Step 4: Rifai `app/src/app/globals.css`**

Sostituisci l'intero contenuto con:

```css
@import "tailwindcss";

@theme {
  /* Base */
  --bg: #FAF7F2;
  --surface: #FFFFFF;
  --surface-muted: #F3EDE4;
  --border: #E4DBCE;
  --text: #2C1810;
  --text-muted: #7A6857;
  --primary: #C25A3B;
  --primary-hover: #A34A2E;
  --secondary: #87A96B;
  --warning: #D89B4A;
  --danger: #B04A3C;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-geist), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 {
  font-family: var(--font-fraunces), Georgia, serif;
  color: var(--text);
}
```

- [ ] **Step 5: Aggiorna `app/src/app/layout.tsx`**

Sostituisci il file esistente con:

```tsx
import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Regìa",
  description:
    "Piattaforma di marketing e operazioni commerciali multi-marchio (gruppo Lenny + stazione Eni, San Marino).",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${fraunces.variable} ${geist.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Verifica build + dev server**

```bash
cd app
npm run build
```
Expected: build success, no Tailwind errors.

Poi:
```bash
npm run dev
```
Apri http://localhost:3000 → verifica che sfondo sia crema (`#FAF7F2`), testo bruno, i titoli usino font serif. Ferma dev server (Ctrl+C).

- [ ] **Step 7: Verifica CI**

```bash
npm run ci
```
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add app/postcss.config.js app/tailwind.config.ts app/src/app/globals.css app/src/app/layout.tsx app/package.json app/package-lock.json
git commit -m "RS-6 RF-2.7: Tailwind v4 + palette editoriale calda + font Fraunces/Geist"
```

---

## Task 2 — shadcn/ui setup + 12 componenti primitivi

**Files:**
- Create: `app/components.json`
- Create: `app/src/components/ui/{button,card,select,sheet,table,input,label,badge,avatar,separator,dropdown-menu}.tsx` (12 file generati da shadcn CLI)
- Modify: `app/package.json` (deps aggiunte da shadcn)

**Interfaces:**
- Consuma: Tailwind + CSS vars di Task 1
- Produce: 11 componenti UI shadcn importabili da `@/components/ui/*`. Contratto standard shadcn/ui documentato ufficialmente.

- [ ] **Step 1: Init shadcn/ui**

```bash
cd app
npx shadcn@latest init
```
Prompt:
- Style: `new-york`
- Base color: `Zinc` (non useremo la palette shadcn — la nostra è custom via CSS vars; questa scelta è solo per il boilerplate iniziale che poi sovrascriviamo)
- CSS variables: `Yes`

Risultato: crea `app/components.json`, aggiorna `app/src/app/globals.css` con base shadcn styles.

- [ ] **Step 2: Ripristina `globals.css` con la nostra palette**

`npx shadcn init` avrà sovrascritto/aggiunto ai nostri CSS vars. Riapri `app/src/app/globals.css` e assicurati che rimangano le CSS vars del Task 1 (`--bg`, `--surface`, ecc.) e le direttive Tailwind. Aggiungi le vars shadcn richieste dai componenti (accanto alle nostre, dentro `@theme`):

```css
@theme {
  /* ... nostre 11 vars (Task 1) ... */

  /* Alias shadcn (mappati sulla nostra palette) */
  --background: var(--bg);
  --foreground: var(--text);
  --card: var(--surface);
  --card-foreground: var(--text);
  --popover: var(--surface);
  --popover-foreground: var(--text);
  --primary-foreground: #FFFFFF;
  --secondary-foreground: #FFFFFF;
  --muted: var(--surface-muted);
  --muted-foreground: var(--text-muted);
  --accent: var(--surface-muted);
  --accent-foreground: var(--text);
  --destructive: var(--danger);
  --destructive-foreground: #FFFFFF;
  --input: var(--border);
  --ring: var(--primary);
  --radius: 0.5rem;
}
```

- [ ] **Step 3: Installa i 11 componenti shadcn**

```bash
cd app
npx shadcn@latest add button card select sheet table input label badge avatar separator dropdown-menu
```
Risultato: 11 file `.tsx` in `app/src/components/ui/`. La CLI installa anche runtime deps: `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/*` per Sheet/Select/DropdownMenu/Avatar.

Nota: le 11 componenti sono `button`, `card`, `select`, `sheet`, `table`, `input`, `label`, `badge`, `avatar`, `separator`, `dropdown-menu` — questi sono i primitivi richiesti dallo spec.

- [ ] **Step 4: Installa `lucide-react` per le icone**

```bash
cd app
npm install lucide-react
```

- [ ] **Step 5: Verifica build + typecheck**

```bash
cd app
npm run build
npm run typecheck
```
Expected: entrambi exit 0.

- [ ] **Step 6: Verifica CI**

```bash
npm run ci
```
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/components.json app/src/components/ui/ app/src/app/globals.css app/package.json app/package-lock.json
git commit -m "RS-6: shadcn/ui setup con 11 componenti primitivi + lucide-react"
```

---

## Task 3 — BrandChip + primo test UI (vitest jsdom + testing-library)

**Files:**
- Create: `app/src/components/brand/brand-chip.tsx`
- Create: `app/tests/ui/brand-chip.test.tsx`
- Modify: `app/vitest.config.ts` (aggiungi `environmentMatchGlobs`)
- Modify: `app/package.json` (deps test UI)

**Interfaces:**
- Consuma: nulla dai task precedenti (componente stand-alone)
- Produce: componente `<BrandChip brand="lenny" | "stazione" | "eni-cafe" | "officina" />` importabile da `@/components/brand/brand-chip`. Attributi HTML: `<span>` con pallino colorato + testo nome marchio.

- [ ] **Step 1: Installa deps test UI**

```bash
cd app
npm install --save-dev @testing-library/react @testing-library/dom jsdom @types/react-dom
```

- [ ] **Step 2: Aggiorna `app/vitest.config.ts`**

Sostituisci con:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 15_000,
    environmentMatchGlobs: [
      ["tests/ui/**/*.test.tsx", "jsdom"],
      ["**/*.test.ts", "node"],
    ],
  },
});
```

Installa `@vitejs/plugin-react`:
```bash
npm install --save-dev @vitejs/plugin-react
```

- [ ] **Step 3: Scrivi il test PRIMA del componente (TDD RED)**

Crea `app/tests/ui/brand-chip.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandChip } from "@/components/brand/brand-chip";

describe("BrandChip", () => {
  it("renders Lenny with orange dot", () => {
    render(<BrandChip brand="lenny" />);
    expect(screen.getByText("Lenny")).toBeDefined();
    const dot = screen.getByTestId("brand-dot-lenny");
    expect(dot.style.backgroundColor).toBe("rgb(255, 107, 53)"); // #FF6B35
  });

  it("renders Stazione with blue dot", () => {
    render(<BrandChip brand="stazione" />);
    expect(screen.getByText("Stazione")).toBeDefined();
    const dot = screen.getByTestId("brand-dot-stazione");
    expect(dot.style.backgroundColor).toBe("rgb(30, 95, 140)"); // #1E5F8C
  });

  it("renders Eni Cafè with brown dot", () => {
    render(<BrandChip brand="eni-cafe" />);
    expect(screen.getByText("Eni Cafè")).toBeDefined();
    const dot = screen.getByTestId("brand-dot-eni-cafe");
    expect(dot.style.backgroundColor).toBe("rgb(140, 94, 30)"); // #8C5E1E
  });

  it("renders Officina with graphite dot", () => {
    render(<BrandChip brand="officina" />);
    expect(screen.getByText("Officina")).toBeDefined();
    const dot = screen.getByTestId("brand-dot-officina");
    expect(dot.style.backgroundColor).toBe("rgb(62, 76, 89)"); // #3E4C59
  });
});
```

- [ ] **Step 4: Esegui il test — DEVE FALLIRE**

```bash
cd app
set -a; source .env.local; set +a
npx dotenv -e .env.local -- npx vitest run tests/ui/brand-chip.test.tsx
```
Expected: FAIL con "Cannot find module '@/components/brand/brand-chip'".

- [ ] **Step 5: Crea il componente**

`app/src/components/brand/brand-chip.tsx`:

```tsx
// Chip colorato per marchio. Colori identità fissi (non da CSS vars — sono valori
// del brand kit, non parte del tema). Riusato ovunque compare un marchio (RF-2.6).

type BrandSlug = "lenny" | "stazione" | "eni-cafe" | "officina";

const BRAND_META: Record<BrandSlug, { name: string; color: string }> = {
  lenny: { name: "Lenny", color: "#FF6B35" },
  stazione: { name: "Stazione", color: "#1E5F8C" },
  "eni-cafe": { name: "Eni Cafè", color: "#8C5E1E" },
  officina: { name: "Officina", color: "#3E4C59" },
};

export function BrandChip({ brand }: { brand: BrandSlug }) {
  const meta = BRAND_META[brand];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-text">
      <span
        data-testid={`brand-dot-${brand}`}
        style={{ backgroundColor: meta.color }}
        className="h-2 w-2 rounded-full"
        aria-hidden="true"
      />
      {meta.name}
    </span>
  );
}
```

- [ ] **Step 6: Esegui il test — DEVE PASSARE**

```bash
cd app
npx dotenv -e .env.local -- npx vitest run tests/ui/brand-chip.test.tsx
```
Expected: 4/4 passing.

- [ ] **Step 7: Verifica CI completa**

```bash
npm run ci
```
Expected: exit 0. Tutti i test (9 totali ora: 3 F0 organization/brand + 3 F0 audit + 2 F0 boundaries + 4 nuovi UI = 12) devono passare.

- [ ] **Step 8: Commit**

```bash
git add app/vitest.config.ts app/src/components/brand/brand-chip.tsx app/tests/ui/brand-chip.test.tsx app/package.json app/package-lock.json
git commit -m "RF-2.6: BrandChip + primo test UI (vitest jsdom + testing-library)"
```

---

## Task 4 — Cookie brand scope + BrandSwitcher

**Files:**
- Create: `app/src/lib/brand/scope.ts`
- Create: `app/src/components/brand/brand-switcher.tsx`

**Interfaces:**
- Consuma: `BrandChip` di Task 3 (per rendere le opzioni)
- Produce:
  - `getBrandScope(): Promise<string>` — legge cookie server-side, ritorna slug o `"all"`
  - `setBrandScope(slug: string): Promise<void>` — server action, scrive cookie + revalidate
  - Componente `<BrandSwitcher currentScope={string} brands={Array<{slug, displayName}>} />` — Select shadcn con chip

- [ ] **Step 1: Crea `app/src/lib/brand/scope.ts`**

```ts
"use server";

// Cookie brand scope: gestione dello scope corrente (marchio selezionato o vista di gruppo).
// RF-2.6: isolamento per marchio + vista di gruppo per l'Owner.
// Nome cookie: regia_brand_scope. Valori: slug marchio ("lenny"|"stazione"|"eni-cafe"|"officina") o "all".

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const COOKIE_NAME = "regia_brand_scope";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 giorni

const ALLOWED_SCOPES = new Set(["all", "lenny", "stazione", "eni-cafe", "officina"]);

export async function getBrandScope(): Promise<string> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value ?? "all";
  return ALLOWED_SCOPES.has(value) ? value : "all";
}

export async function setBrandScope(slug: string): Promise<void> {
  if (!ALLOWED_SCOPES.has(slug)) {
    throw new Error(`Brand scope non valido: ${slug}`);
  }
  const store = await cookies();
  store.set(COOKIE_NAME, slug, {
    maxAge: MAX_AGE_SECONDS,
    sameSite: "lax",
    httpOnly: false,
    path: "/",
  });
  revalidatePath("/", "layout");
}
```

- [ ] **Step 2: Crea `app/src/components/brand/brand-switcher.tsx`**

```tsx
"use client";

// Select shadcn per lo scope marchio corrente. Client component perché la Select
// di shadcn necessita di stato interattivo. La server action setBrandScope viene
// chiamata dal handler di onValueChange.

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandChip } from "@/components/brand/brand-chip";
import { setBrandScope } from "@/lib/brand/scope";
import { useTransition } from "react";

type Brand = { slug: string; displayName: string };
type BrandSlug = "lenny" | "stazione" | "eni-cafe" | "officina";

export function BrandSwitcher({
  currentScope,
  brands,
}: {
  currentScope: string;
  brands: Brand[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={currentScope}
      disabled={isPending}
      onValueChange={(next) => {
        startTransition(async () => {
          await setBrandScope(next);
        });
      }}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tutti i marchi</SelectItem>
        {brands.map((b) => (
          <SelectItem key={b.slug} value={b.slug}>
            <div className="flex items-center gap-2">
              <BrandChip brand={b.slug as BrandSlug} />
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 3: Verifica typecheck + build**

```bash
cd app
npm run typecheck
npm run build
```
Expected: entrambi exit 0.

- [ ] **Step 4: Verifica CI**

```bash
npm run ci
```
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/brand/scope.ts app/src/components/brand/brand-switcher.tsx
git commit -m "RF-2.6: cookie brand scope + BrandSwitcher (server action + client Select)"
```

---

## Task 5 — Componenti layout: AppShell, Header, Sidebar, UserMenu

**Files:**
- Create: `app/src/components/layout/app-shell.tsx`
- Create: `app/src/components/layout/header.tsx`
- Create: `app/src/components/layout/sidebar.tsx`
- Create: `app/src/components/layout/user-menu.tsx`

**Interfaces:**
- Consuma: `BrandSwitcher` (Task 4), `BrandChip` (Task 3), shadcn primitives (Task 2), `getSessionOrRedirect` (F0), `getBrandScope` (Task 4)
- Produce: `<AppShell>{children}</AppShell>` — wrapper globale che rende header + sidebar + main con `children` nel main. Server component. Legge sessione e scope internamente.

- [ ] **Step 1: Crea `app/src/components/layout/sidebar.tsx`**

```tsx
"use client";

// Sidebar navigation con drawer mobile.
// Voci F1.1: Home, Marchi, Audit log, Impostazioni.
// F1.2+ aggiungeranno voci qui.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Tag, ScrollText, Settings, LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(protected)/logout-action";

type NavItem = { href: string; label: string; icon: typeof Home };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/marchi", label: "Marchi", icon: Tag },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/impostazioni", label: "Impostazioni", icon: Settings },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {NAV.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-l-[3px] border-primary bg-surface-muted text-primary"
                : "text-text hover:bg-surface-muted"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
      <form action={logout} className="mt-auto pt-4">
        <Button
          type="submit"
          variant="ghost"
          className="w-full justify-start gap-3 text-sm font-medium"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Esci
        </Button>
      </form>
    </nav>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface md:flex md:flex-col">
      <NavList />
    </aside>
  );
}

export function MobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Apri menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="font-serif text-lg">Regìa</SheetTitle>
        </SheetHeader>
        <NavList />
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Crea `app/src/components/layout/user-menu.tsx`**

```tsx
"use client";

// Dropdown avatar utente. Mostra iniziali, email, link a impostazioni, esci.

import Link from "next/link";
import { Settings, LogOut, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/app/(protected)/logout-action";

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function UserMenu({ email, role }: { email: string; role: string }) {
  const initials = initialsFromEmail(email);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <Avatar className="h-8 w-8 bg-primary text-primary-foreground">
            <AvatarFallback className="bg-primary text-xs font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <ChevronDown className="h-3 w-3 text-text-muted" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{email}</span>
            <span className="text-xs text-text-muted">Ruolo: {role}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/impostazioni" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Impostazioni
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={logout}>
          <DropdownMenuItem asChild>
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut className="h-4 w-4" />
              Esci
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: Crea logout server action**

`app/src/app/(protected)/logout-action.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/db/server";

export async function logout() {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 4: Crea `app/src/components/layout/header.tsx`**

```tsx
// Header globale. Server component: legge scope e marchi lato server.

import Link from "next/link";
import { MobileSidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { BrandSwitcher } from "@/components/brand/brand-switcher";
import { getBrandScope } from "@/lib/brand/scope";
import { getAdminClient } from "@/lib/db/admin";

export async function Header({ email, role }: { email: string; role: string }) {
  const scope = await getBrandScope();
  const admin = getAdminClient();
  // F0: no RLS select policy yet — bypass via service_role. Rimosso in F1.2 quando arrivano policy select.
  const { data: brandRows } = await admin
    .from("brands")
    .select("slug, display_name")
    .order("display_name");

  const brands = (brandRows ?? []).map((b: { slug: string; display_name: string }) => ({
    slug: b.slug,
    displayName: b.display_name,
  }));

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <MobileSidebar />
        <Link
          href="/dashboard"
          className="font-serif text-xl font-semibold text-text"
        >
          Regìa
        </Link>
      </div>

      <BrandSwitcher currentScope={scope} brands={brands} />

      <UserMenu email={email} role={role} />
    </header>
  );
}
```

- [ ] **Step 5: Crea `app/src/components/layout/app-shell.tsx`**

```tsx
// Wrapper globale per pagine protette: header + sidebar + main.
// Server component: legge sessione internamente via getSessionOrRedirect (già chiamato dal layout, qui riceviamo i dati per props).

import { DesktopSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export async function AppShell({
  children,
  email,
  role,
}: {
  children: React.ReactNode;
  email: string;
  role: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <Header email={email} role={role} />
      <div className="flex flex-1">
        <DesktopSidebar />
        <main className="flex-1 px-4 py-6 md:px-6 lg:mx-auto lg:max-w-6xl lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verifica typecheck + build**

```bash
cd app
npm run typecheck
npm run build
```
Expected: entrambi exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/layout/ app/src/app/(protected)/logout-action.ts
git commit -m "RF-2.6 RNF-5: layout components (AppShell, Header, Sidebar, UserMenu) responsive"
```

---

## Task 6 — Landing pubblica + login restilizzati

**Files:**
- Modify: `app/src/app/page.tsx` (landing)
- Modify: `app/src/app/login/page.tsx` (form login stilizzato)
- Modify: `app/src/app/(protected)/layout.tsx` (avvolge in AppShell)

**Interfaces:**
- Consuma: shadcn primitives (Task 2), fonts + palette (Task 1), `AppShell` (Task 5), `getSessionOrRedirect` (F0)
- Produce: 3 pagine ridipinte

- [ ] **Step 1: Rifai `app/src/app/page.tsx`**

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <h1 className="font-serif text-5xl font-semibold text-text md:text-6xl">Regìa</h1>
      <p className="mt-4 max-w-lg text-lg text-text-muted">
        Piattaforma di marketing e operazioni commerciali multi-marchio.
        Gruppo Lenny + Stazione, San Marino.
      </p>
      <Button asChild size="lg" className="mt-8 bg-primary text-white hover:bg-primary-hover">
        <Link href="/login">Accedi</Link>
      </Button>
      <footer className="mt-16 text-xs text-text-muted">
        Cantiere F0 · 8 set 2026 · Fase corrente: F1.1 layout
      </footer>
    </main>
  );
}
```

- [ ] **Step 2: Rifai `app/src/app/login/page.tsx`**

```tsx
import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-6 text-center font-serif text-3xl font-semibold text-text">
          Regìa
        </h1>
        {params.error && (
          <p className="mb-4 rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {decodeURIComponent(params.error)}
          </p>
        )}
        <form action={login} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <Button type="submit" className="bg-primary text-white hover:bg-primary-hover">
            Accedi
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-text-muted">
          Sviluppo locale: crea il primo Owner con <code>bash app/scripts/dev-create-owner.sh</code>
          <br />
          (vedi <code>docs/runbook-primo-owner.md</code>)
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Aggiorna `app/src/app/(protected)/layout.tsx`**

```tsx
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
import { AppShell } from "@/components/layout/app-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionOrRedirect();

  // F0: no RLS select policy yet — bypass via service_role.
  const admin = getAdminClient();
  const { data: userRow } = await admin.auth.admin.getUserById(session.userId);
  const email = userRow.user?.email ?? "utente@regia.local";

  return (
    <AppShell email={email} role={session.role}>
      {children}
    </AppShell>
  );
}
```

- [ ] **Step 4: Verifica dev server + browser**

```bash
cd app
npm run dev
```

Nel browser:
- http://localhost:3000 → landing con "Regìa" gigante centrato, sfondo crema, pulsante terracotta "Accedi"
- http://localhost:3000/login → form card centrato, input stilizzati
- login con `owner@regia.local` / `owner-dev-2026` → dashboard (ancora vecchia, sarà rifatta in Task 8)

Ferma dev server (Ctrl+C).

- [ ] **Step 5: Verifica CI**

```bash
npm run ci
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/src/app/page.tsx app/src/app/login/page.tsx app/src/app/\(protected\)/layout.tsx
git commit -m "RS-6: landing pubblica + login restilizzati + protected layout in AppShell"
```

---

## Task 7 — Modulo M12 daily-use + DashboardStats + test invariante

**Files:**
- Create: `app/src/modules/m12-daily-use/public.ts`
- Create: `app/src/modules/m12-daily-use/internal/dashboard-stats.ts`
- Create: `app/src/modules/m12-daily-use/README.md`
- Create: `app/tests/invariants/dashboard-stats.test.ts`

**Interfaces:**
- Consuma: `getAdminClient` da `@/lib/db/admin` (F0)
- Produce:
  - `getDashboardStats(organizationId: string): Promise<DashboardStats>` — accessibile solo via `@/modules/m12-daily-use/public`
  - Tipo `DashboardStats` (vedi Step 3)

- [ ] **Step 1: Scrivi il test invariante PRIMA (TDD RED)**

`app/tests/invariants/dashboard-stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getDashboardStats } from "@/modules/m12-daily-use/public";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const FAKE_ORG_ID = "00000000-0000-0000-0000-000000000099";

describe("M12 · getDashboardStats", () => {
  it("returns 4 brands from seed for the real org", async () => {
    const stats = await getDashboardStats(ORG_ID);
    expect(stats.going.brands.length).toBe(4);
    const slugs = stats.going.brands.map((b) => b.slug).sort();
    expect(slugs).toEqual(["eni-cafe", "lenny", "officina", "stazione"]);
  });

  it("returns 0 for future-table counters without throwing", async () => {
    const stats = await getDashboardStats(ORG_ID);
    expect(stats.toDo.contentsPending).toBe(0);
    expect(stats.toDo.reviewsPending).toBe(0);
    expect(stats.toDo.restaurantsCooling).toBe(0);
    expect(stats.toDo.costAlerts).toBe(0);
  });

  it("respects organization scoping (fake org returns 0 brands)", async () => {
    const stats = await getDashboardStats(FAKE_ORG_ID);
    expect(stats.going.brands.length).toBe(0);
  });

  it("reports environment as sviluppo-locale by default", async () => {
    const stats = await getDashboardStats(ORG_ID);
    expect(stats.going.environment).toBe("sviluppo-locale");
  });
});
```

- [ ] **Step 2: Esegui il test — DEVE FALLIRE**

```bash
cd app
npx dotenv -e .env.local -- npx vitest run tests/invariants/dashboard-stats.test.ts
```
Expected: FAIL con "Cannot find module '@/modules/m12-daily-use/public'".

- [ ] **Step 3: Crea `app/src/modules/m12-daily-use/internal/dashboard-stats.ts`**

```ts
// M12 daily use — dashboard stats aggregation (RF-12.1).
// Query aggregate per Home M12: contatori "cosa devi fare" + info "come sta andando".
// I contatori per tabelle non ancora esistenti (contents, reviews, restaurants, cost_alerts)
// ritornano 0 senza throw grazie al catch su Postgres error 42P01 (undefined_table).
// Quando F1.2+ aggiunge le tabelle, i valori si popolano automaticamente.

import { getAdminClient } from "@/lib/db/admin";
import fs from "node:fs/promises";
import path from "node:path";

export type Environment = "sviluppo-locale" | "staging" | "produzione";

export type DashboardStats = {
  organizationId: string;
  toDo: {
    contentsPending: number;
    reviewsPending: number;
    restaurantsCooling: number;
    costAlerts: number;
  };
  going: {
    brands: Array<{ slug: string; displayName: string }>;
    lastAuthEventAt: string | null;
    lastBackupAt: string | null;
    environment: Environment;
  };
};

const UNDEFINED_TABLE_CODE = "42P01";

async function safeCount(
  table: string,
  organizationId: string,
): Promise<number> {
  const admin = getAdminClient();
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (error) {
    if (error.code === UNDEFINED_TABLE_CODE) return 0;
    // Anche errori di colonna mancante (42703) sono tollerati: tabelle future
    // potrebbero non avere ancora organization_id.
    if (error.code === "42703") return 0;
    throw error;
  }
  return count ?? 0;
}

async function getLastAuthEvent(organizationId: string): Promise<string | null> {
  const admin = getAdminClient();
  const { data } = await admin
    .from("audit_events")
    .select("created_at")
    .eq("organization_id", organizationId)
    .like("action", "auth.%")
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.created_at ?? null;
}

async function getLastBackupAt(): Promise<string | null> {
  try {
    const backupsDir = path.resolve(process.cwd(), "backups");
    const entries = await fs.readdir(backupsDir);
    const sqlFiles = entries.filter((e) => e.endsWith(".sql"));
    if (sqlFiles.length === 0) return null;
    const stats = await Promise.all(
      sqlFiles.map(async (f) => {
        const st = await fs.stat(path.join(backupsDir, f));
        return { name: f, mtime: st.mtime };
      }),
    );
    stats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return stats[0]?.mtime.toISOString() ?? null;
  } catch {
    // backups dir non esiste o non leggibile
    return null;
  }
}

function getEnvironment(): Environment {
  const env = process.env["REGIA_ENVIRONMENT"];
  if (env === "produzione" || env === "staging") return env;
  return "sviluppo-locale";
}

export async function getDashboardStats(
  organizationId: string,
): Promise<DashboardStats> {
  const admin = getAdminClient();

  const [
    contentsPending,
    reviewsPending,
    restaurantsCooling,
    costAlerts,
    brandsResult,
    lastAuthEventAt,
    lastBackupAt,
  ] = await Promise.all([
    safeCount("contents", organizationId),
    safeCount("reviews", organizationId),
    safeCount("restaurants", organizationId),
    safeCount("cost_alerts", organizationId),
    admin
      .from("brands")
      .select("slug, display_name")
      .eq("organization_id", organizationId)
      .order("display_name"),
    getLastAuthEvent(organizationId),
    getLastBackupAt(),
  ]);

  const brands = (brandsResult.data ?? []).map(
    (b: { slug: string; display_name: string }) => ({
      slug: b.slug,
      displayName: b.display_name,
    }),
  );

  return {
    organizationId,
    toDo: {
      contentsPending,
      reviewsPending,
      restaurantsCooling,
      costAlerts,
    },
    going: {
      brands,
      lastAuthEventAt,
      lastBackupAt,
      environment: getEnvironment(),
    },
  };
}
```

- [ ] **Step 4: Crea `app/src/modules/m12-daily-use/public.ts`**

```ts
// M12 — Uso quotidiano. Interfaccia pubblica (RS-1).
// Tutto ciò che non è esportato qui è privato: non importarlo da fuori.

export { getDashboardStats } from "./internal/dashboard-stats";
export type { DashboardStats, Environment } from "./internal/dashboard-stats";
```

- [ ] **Step 5: Crea `app/src/modules/m12-daily-use/README.md`**

```markdown
# M12 — Uso quotidiano

Home mobile-first "cosa devi fare / come sta andando" (RF-12.1), calendario ricorrenze
(RF-12.4), assenza titolare + delega (RF-12.6), aiuto contestuale (RF-12.7) — in F1.1
esiste solo la stat aggregation per la home.

## Interfaccia pubblica (`public.ts`)

- `getDashboardStats(organizationId): Promise<DashboardStats>` — RF-12.1
- tipo `DashboardStats`
- tipo `Environment` (`"sviluppo-locale" | "staging" | "produzione"`)

## Note tecniche

- I contatori delle "cose da fare" fanno query su tabelle che potrebbero non esistere
  ancora in F0/F1.1 (contents, reviews, restaurants, cost_alerts). Il codice gestisce
  Postgres error 42P01 (undefined_table) ritornando 0 senza throw.
- `lastBackupAt` legge dal filesystem `app/backups/`. In F0-b sarà API Supabase.
- `environment` deriva da `REGIA_ENVIRONMENT` env var, default "sviluppo-locale".

Tutto il resto è privato (`internal/`) e non deve essere importato da altri moduli.
```

- [ ] **Step 6: Esegui il test — DEVE PASSARE**

```bash
cd app
npx dotenv -e .env.local -- npx vitest run tests/invariants/dashboard-stats.test.ts
```
Expected: 4/4 passing.

- [ ] **Step 7: Verifica boundaries + CI**

```bash
npm run boundaries
npm run ci
```
Expected: entrambi exit 0. `boundaries` deve trovare 2 moduli (m11-admin, m12-daily-use) senza violazioni.

- [ ] **Step 8: Commit**

```bash
git add app/src/modules/m12-daily-use/ app/tests/invariants/dashboard-stats.test.ts
git commit -m "RF-12.1 RS-1 RS-3: modulo M12 daily-use con DashboardStats + test invariante"
```

---

## Task 8 — Dashboard M12 page + MetricCard + EnvironmentBadge

**Files:**
- Create: `app/src/components/dashboard/metric-card.tsx`
- Create: `app/src/components/dashboard/environment-badge.tsx`
- Modify: `app/src/app/(protected)/dashboard/page.tsx` (rifatta)
- Create: `app/src/app/(protected)/dashboard/loading.tsx`
- Create: `app/src/app/(protected)/dashboard/error.tsx`

**Interfaces:**
- Consuma: `getDashboardStats` (Task 7), `BrandChip` (Task 3), `getSessionOrRedirect` (F0), shadcn Card
- Produce: `<MetricCard label value footer />`, `<EnvironmentBadge environment />`, pagina `/dashboard` funzionante

- [ ] **Step 1: Crea `app/src/components/dashboard/metric-card.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  footer,
}: {
  label: string;
  value: number | string;
  footer?: string;
}) {
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-text-muted">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-serif text-3xl font-semibold text-text">{value}</div>
        {footer && (
          <p className="mt-1 text-xs text-text-muted">{footer}</p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Crea `app/src/components/dashboard/environment-badge.tsx`**

```tsx
import type { Environment } from "@/modules/m12-daily-use/public";

const LABELS: Record<Environment, string> = {
  "sviluppo-locale": "Sviluppo locale",
  staging: "Staging",
  produzione: "Produzione",
};

const COLORS: Record<Environment, string> = {
  "sviluppo-locale": "bg-secondary/15 text-secondary border-secondary/30",
  staging: "bg-warning/15 text-warning border-warning/30",
  produzione: "bg-primary/15 text-primary border-primary/30",
};

export function EnvironmentBadge({ environment }: { environment: Environment }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${COLORS[environment]}`}
    >
      {LABELS[environment]}
    </span>
  );
}
```

- [ ] **Step 3: Rifai `app/src/app/(protected)/dashboard/page.tsx`**

```tsx
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getDashboardStats } from "@/modules/m12-daily-use/public";
import { MetricCard } from "@/components/dashboard/metric-card";
import { EnvironmentBadge } from "@/components/dashboard/environment-badge";
import { BrandChip } from "@/components/brand/brand-chip";

type BrandSlug = "lenny" | "stazione" | "eni-cafe" | "officina";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardPage() {
  const session = await getSessionOrRedirect();
  const stats = await getDashboardStats(session.organizationId);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-text">
          Buongiorno
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Panoramica di oggi. Come sta andando la piattaforma.
        </p>
      </header>

      <section aria-labelledby="todo">
        <h2 id="todo" className="mb-3 font-serif text-xl font-semibold text-text">
          Cosa devi fare
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard
            label="Contenuti da approvare"
            value={stats.toDo.contentsPending}
            footer={stats.toDo.contentsPending === 0 ? "Attivo in F2" : undefined}
          />
          <MetricCard
            label="Recensioni da gestire"
            value={stats.toDo.reviewsPending}
            footer={stats.toDo.reviewsPending === 0 ? "Attivo in F2" : undefined}
          />
          <MetricCard
            label="Ristoranti in raffreddamento"
            value={stats.toDo.restaurantsCooling}
            footer={stats.toDo.restaurantsCooling === 0 ? "Attivo in F3" : undefined}
          />
          <MetricCard
            label="Allarmi costi"
            value={stats.toDo.costAlerts}
            footer={stats.toDo.costAlerts === 0 ? "Attivo in F2" : undefined}
          />
        </div>
      </section>

      <section aria-labelledby="going" className="space-y-4">
        <h2 id="going" className="font-serif text-xl font-semibold text-text">
          Come sta andando
        </h2>

        <div className="rounded-lg border border-border bg-surface p-6">
          <h3 className="mb-3 text-sm font-medium text-text-muted">
            Marchi attivi
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.going.brands.map((b) => (
              <BrandChip key={b.slug} brand={b.slug as BrandSlug} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-6">
            <h3 className="mb-2 text-sm font-medium text-text-muted">
              Ultimo accesso al sistema
            </h3>
            <p className="text-base text-text">
              {formatDate(stats.going.lastAuthEventAt)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-6">
            <h3 className="mb-2 text-sm font-medium text-text-muted">
              Ultimo backup
            </h3>
            <p className="text-base text-text">
              {formatDate(stats.going.lastBackupAt)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-6">
            <h3 className="mb-2 text-sm font-medium text-text-muted">
              Ambiente
            </h3>
            <EnvironmentBadge environment={stats.going.environment} />
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Crea `app/src/app/(protected)/dashboard/loading.tsx`**

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="h-10 w-48 animate-pulse rounded bg-surface-muted" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border bg-surface">
            <CardHeader className="pb-2">
              <div className="h-4 w-32 animate-pulse rounded bg-surface-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 animate-pulse rounded bg-surface-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Crea `app/src/app/(protected)/dashboard/error.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 p-6">
      <h2 className="font-serif text-xl font-semibold text-danger">
        Errore nel caricamento della dashboard
      </h2>
      <p className="mt-2 text-sm text-text-muted">{error.message}</p>
      <Button onClick={reset} className="mt-4 bg-primary text-white hover:bg-primary-hover">
        Ricarica
      </Button>
    </div>
  );
}
```

- [ ] **Step 6: Verifica in browser**

```bash
cd app
npm run dev
```
Login → `/dashboard` → verifica:
- Titolo "Buongiorno" con font serif
- 4 metric card in griglia (tutti a 0 con footer "Attivo in F2/F3")
- Sezione "Come sta andando" con 4 chip marchio + 3 card (ultimo accesso, ultimo backup, ambiente)
- Ambiente = badge verde "Sviluppo locale"

Ferma dev server.

- [ ] **Step 7: Verifica CI**

```bash
npm run ci
```
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/dashboard/ app/src/app/\(protected\)/dashboard/
git commit -m "RF-12.1: Home M12 con MetricCard + EnvironmentBadge + brand chips"
```

---

## Task 9 — Pagina Marchi (RO)

**Files:**
- Create: `app/src/app/(protected)/marchi/page.tsx`
- Create: `app/src/app/(protected)/marchi/loading.tsx`
- Create: `app/src/app/(protected)/marchi/error.tsx`

**Interfaces:**
- Consuma: `getAdminClient` (F0), `getSessionOrRedirect` (F0), `BrandChip` (Task 3), Table shadcn
- Produce: pagina `/marchi` con lista dei 4 marchi

- [ ] **Step 1: Crea `app/src/app/(protected)/marchi/page.tsx`**

```tsx
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
import { BrandChip } from "@/components/brand/brand-chip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type BrandSlug = "lenny" | "stazione" | "eni-cafe" | "officina";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function MarchiPage() {
  const session = await getSessionOrRedirect();
  const admin = getAdminClient();
  // F0: no RLS select policy yet — bypass via service_role.
  const { data } = await admin
    .from("brands")
    .select("id, slug, display_name, created_at")
    .eq("organization_id", session.organizationId)
    .order("display_name");

  const brands = (data ?? []) as Array<{
    id: string;
    slug: string;
    display_name: string;
    created_at: string;
  }>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-text">Marchi</h1>
        <p className="mt-1 text-sm text-text-muted">
          I quattro marchi del gruppo, configurati come dati (RF-2.1). L'editing arriva in F1.2 (Brand kit).
        </p>
      </header>

      <div className="flex items-center gap-2">
        <span className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs text-text-muted">
          Configurato · read-only in F1.1
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marchio</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Data creazione</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <BrandChip brand={b.slug as BrandSlug} />
                </TableCell>
                <TableCell className="font-medium">{b.display_name}</TableCell>
                <TableCell>
                  <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">
                    {b.slug}
                  </code>
                </TableCell>
                <TableCell className="text-text-muted">
                  {formatDate(b.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crea `app/src/app/(protected)/marchi/loading.tsx`**

```tsx
export default function MarchiLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-32 animate-pulse rounded bg-surface-muted" />
      <div className="rounded-lg border border-border bg-surface p-8">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crea `app/src/app/(protected)/marchi/error.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";

export default function MarchiError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 p-6">
      <h2 className="font-serif text-xl font-semibold text-danger">
        Errore nel caricamento marchi
      </h2>
      <p className="mt-2 text-sm text-text-muted">{error.message}</p>
      <Button onClick={reset} className="mt-4 bg-primary text-white hover:bg-primary-hover">
        Ricarica
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Verifica in browser**

```bash
cd app
npm run dev
```
Login → `/marchi` → verifica tabella con 4 righe (Eni Cafè, Lenny, Officina, Stazione ordinati alfabeticamente), ognuna con chip + nome + slug + data. Ferma.

- [ ] **Step 5: Verifica CI**

```bash
npm run ci
```

- [ ] **Step 6: Commit**

```bash
git add app/src/app/\(protected\)/marchi/
git commit -m "RF-2.1: pagina Marchi read-only in F1.1"
```

---

## Task 10 — Pagina Audit log (consuma M11)

**Files:**
- Create: `app/src/app/(protected)/audit/page.tsx`
- Create: `app/src/app/(protected)/audit/loading.tsx`
- Create: `app/src/app/(protected)/audit/error.tsx`

**Interfaces:**
- Consuma: `getRecentAuditEvents` da `@/modules/m11-admin/public` (F0), `getSessionOrRedirect` (F0), Table + Select shadcn
- Produce: pagina `/audit` con lista 50 eventi + filtro per actor_kind (server action)

- [ ] **Step 1: Crea `app/src/app/(protected)/audit/page.tsx`**

```tsx
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getRecentAuditEvents } from "@/modules/m11-admin/public";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ActorKind = "user" | "agent" | "system";

const ACTOR_LABELS: Record<ActorKind, string> = {
  user: "utente",
  agent: "agente",
  system: "sistema",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string }>;
}) {
  const session = await getSessionOrRedirect();
  const params = await searchParams;
  const actorFilter = params.actor;

  const events = await getRecentAuditEvents(session.organizationId, 50);
  const filtered =
    actorFilter && ["user", "agent", "system"].includes(actorFilter)
      ? events.filter((e) => e.actor_kind === actorFilter)
      : events;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-text">Audit log</h1>
        <p className="mt-1 text-sm text-text-muted">
          Traccia di ogni azione umana e agente (RF-11.3). Append-only garantito in DB.
        </p>
      </header>

      <div className="flex items-center gap-3">
        <form className="flex items-center gap-2">
          <label htmlFor="actor" className="text-sm text-text-muted">
            Filtro attore:
          </label>
          <select
            id="actor"
            name="actor"
            defaultValue={actorFilter ?? ""}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
          >
            <option value="">Tutti</option>
            <option value="user">Utenti</option>
            <option value="agent">Agenti</option>
            <option value="system">Sistema</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-hover"
          >
            Applica
          </button>
        </form>
        <span className="text-xs text-text-muted">
          {filtered.length} di {events.length} eventi (ultimi 50)
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Attore</TableHead>
              <TableHead>Azione</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Dettagli</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-muted">
                  Nessun evento nel log per il filtro corrente.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs text-text-muted">
                    {formatTimestamp(e.created_at)}
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs">
                      {ACTOR_LABELS[e.actor_kind]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.action}</TableCell>
                  <TableCell className="text-text-muted">{e.target ?? "—"}</TableCell>
                  <TableCell>
                    {Object.keys(e.details).length === 0 ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      <details>
                        <summary className="cursor-pointer text-xs text-primary hover:underline">
                          Espandi
                        </summary>
                        <pre className="mt-2 max-w-xs overflow-x-auto rounded bg-surface-muted p-2 text-xs">
                          {JSON.stringify(e.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Crea `app/src/app/(protected)/audit/loading.tsx`**

```tsx
export default function AuditLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-40 animate-pulse rounded bg-surface-muted" />
      <div className="rounded-lg border border-border bg-surface p-8">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 w-full animate-pulse rounded bg-surface-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crea `app/src/app/(protected)/audit/error.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";

export default function AuditError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 p-6">
      <h2 className="font-serif text-xl font-semibold text-danger">
        Errore nel caricamento audit log
      </h2>
      <p className="mt-2 text-sm text-text-muted">{error.message}</p>
      <Button onClick={reset} className="mt-4 bg-primary text-white hover:bg-primary-hover">
        Ricarica
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Verifica in browser**

```bash
cd app
npm run dev
```
Login → `/audit` → verifica tabella con eventi (almeno gli auth login/logout se esistono). Testa filtro `?actor=user`. Ferma.

- [ ] **Step 5: Verifica CI + boundaries**

```bash
npm run ci
npm run boundaries
```
Expected: entrambi exit 0. Boundaries verifica che `/audit/page.tsx` importi solo da `@/modules/m11-admin/public` (non da `internal/`).

- [ ] **Step 6: Commit**

```bash
git add app/src/app/\(protected\)/audit/
git commit -m "RF-11.3 RS-1: pagina Audit log consumando modulo M11 via public.ts"
```

---

## Task 11 — Pagina Impostazioni

**Files:**
- Create: `app/src/app/(protected)/impostazioni/page.tsx`
- Create: `app/src/app/(protected)/impostazioni/loading.tsx`
- Create: `app/src/app/(protected)/impostazioni/error.tsx`

**Interfaces:**
- Consuma: `getSessionOrRedirect` (F0), `getAdminClient` (F0), logout server action (Task 5)
- Produce: pagina `/impostazioni` con profilo + info ambiente + logout

- [ ] **Step 1: Crea `app/src/app/(protected)/impostazioni/page.tsx`**

```tsx
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(protected)/logout-action";

function maskSupabaseUrl(url: string | undefined): string {
  if (!url) return "n/d";
  // http://127.0.0.1:54520 → http://127.0.0.1:5452*
  return url.replace(/(\d)(?=\d?$)/, "*");
}

export default async function ImpostazioniPage() {
  const session = await getSessionOrRedirect();
  const admin = getAdminClient();
  const { data: userRow } = await admin.auth.admin.getUserById(session.userId);
  const email = userRow.user?.email ?? "utente@regia.local";

  const { data: profile } = await admin
    .from("users_profile")
    .select("requires_mfa")
    .eq("user_id", session.userId)
    .single();
  const requiresMfa = profile?.requires_mfa ?? false;

  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const appVersion = process.env["npm_package_version"] ?? "0.1.0";
  const gitSha = process.env["GIT_SHA"] ?? "n/d";

  const roleColors: Record<string, string> = {
    owner: "bg-primary/15 text-primary border-primary/30",
    editor: "bg-secondary/15 text-secondary border-secondary/30",
    delegate: "bg-warning/15 text-warning border-warning/30",
    agent: "bg-text-muted/15 text-text-muted border-text-muted/30",
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-text">Impostazioni</h1>
      </header>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 font-serif text-lg font-semibold text-text">
          Il tuo profilo
        </h2>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-text-muted">Email</dt>
            <dd className="mt-1 text-sm text-text">{email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-text-muted">Ruolo</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                  roleColors[session.role] ?? "bg-surface-muted text-text border-border"
                }`}
              >
                {session.role}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-text-muted">Organization ID</dt>
            <dd className="mt-1 font-mono text-xs text-text">
              {session.organizationId}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-text-muted">2FA</dt>
            <dd className="mt-1 text-sm text-text">
              {requiresMfa ? "Richiesto" : "Non richiesto"}
              <span className="ml-2 text-xs text-text-muted">
                (Predisposizione — 2FA vero in F0-b, RU-3)
              </span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6">
        <h2 className="mb-4 font-serif text-lg font-semibold text-text">Ambiente</h2>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-text-muted">URL Supabase</dt>
            <dd className="mt-1 font-mono text-xs text-text">
              {maskSupabaseUrl(supabaseUrl)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-text-muted">Versione app</dt>
            <dd className="mt-1 font-mono text-xs text-text">{appVersion}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-text-muted">Commit git</dt>
            <dd className="mt-1 font-mono text-xs text-text">{gitSha}</dd>
          </div>
        </dl>
      </section>

      <form action={logout}>
        <Button type="submit" variant="ghost" className="text-danger hover:bg-danger/10">
          Esci
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Crea `app/src/app/(protected)/impostazioni/loading.tsx`**

```tsx
export default function ImpostazioniLoading() {
  return (
    <div className="space-y-8">
      <div className="h-10 w-40 animate-pulse rounded bg-surface-muted" />
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-surface-muted" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-20 animate-pulse rounded bg-surface-muted" />
              <div className="mt-2 h-5 w-40 animate-pulse rounded bg-surface-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crea `app/src/app/(protected)/impostazioni/error.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";

export default function ImpostazioniError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 p-6">
      <h2 className="font-serif text-xl font-semibold text-danger">
        Errore nel caricamento impostazioni
      </h2>
      <p className="mt-2 text-sm text-text-muted">{error.message}</p>
      <Button onClick={reset} className="mt-4 bg-primary text-white hover:bg-primary-hover">
        Ricarica
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Verifica in browser**

```bash
cd app
npm run dev
```
Login → `/impostazioni` → verifica profilo (email, ruolo owner con badge terracotta, org id, MFA info) + ambiente (URL, versione, commit) + pulsante Esci. Testa logout → redirect a `/login`.

- [ ] **Step 5: Verifica CI**

```bash
npm run ci
```

- [ ] **Step 6: Commit**

```bash
git add app/src/app/\(protected\)/impostazioni/
git commit -m "RU-3 RF-2.6: pagina Impostazioni profilo + ambiente + logout"
```

---

## Task 12 — Verifica finale end-to-end + polish + chiusura F1.1

**Files:**
- Modify (se serve): fix di piccole cose emerse dal tour finale

**Interfaces:**
- Nessuna nuova. Solo QA + commit di chiusura F1.1.

- [ ] **Step 1: Ricrea l'utente Owner (in caso `npm run ci` recente lo abbia invalidato)**

```bash
cd app
bash scripts/dev-create-owner.sh
```
Expected: exit 0, "Utente Owner dev pronto." (o "utente già esistente").

- [ ] **Step 2: Verifica CI completa end-to-end**

```bash
cd app
npm run ci
```
Expected: exit 0. Vedi output:
- 1/6 Lint OK
- 2/6 Format:check OK
- 3/6 Typecheck OK
- 4/6 Confini di modulo (2 moduli: m11-admin, m12-daily-use) OK
- 5/6 Verifica migrazioni OK
- 6/6 Test (10+ tests: 3 organization + 1 brand-uniqueness + 3 audit + 2 boundaries + 4 brand-chip + 4 dashboard-stats = 17 tests circa) OK
- "CI locale verde ✓"

- [ ] **Step 3: Tour manuale end-to-end**

```bash
cd app
npm run dev
```

Nel browser:
1. **http://localhost:3000** → landing con "Regìa" gigante, pulsante terracotta
2. Click "Accedi" → **/login** → form card centrato
3. Inserisci `owner@regia.local` / `owner-dev-2026` → **/dashboard**
4. Verifica dashboard: 4 metric cards, 4 chip marchio, 3 card info, badge "Sviluppo locale" verde
5. Sidebar: naviga a **/marchi** → tabella 4 righe
6. **/audit** → lista eventi (almeno 1 auth.login) + filtro
7. **/impostazioni** → profilo + ambiente + Esci
8. Click Esci → redirect a `/login`
9. Testa il **BrandSwitcher** dell'header: cambia scope, ricarica pagina, verifica che la selezione persista (cookie)
10. Ridimensiona a viewport mobile (~375px larghezza): la sidebar deve sparire, appare icona hamburger, click → drawer si apre

Ferma dev server. Se qualcosa non va, torna al task specifico e fixa.

- [ ] **Step 4: Aggiorna diario**

`docs/diario.md` — aggiungi in fondo alla sezione "Fatto":

```markdown
- **8 set 2026 — F1.1 Layout UI + shell completato.**
  - Base grafica editoriale calda (Tailwind v4 + shadcn/ui + Fraunces/Geist).
  - 6 pagine navigabili: landing, login, dashboard M12 con contatori reali, marchi RO, audit log via M11, impostazioni.
  - 2 moduli reali (m11-admin + m12-daily-use) — primo test RS-1 con >1 modulo, dep-cruiser verde.
  - Nuovo pattern test UI (Vitest + jsdom + testing-library), primo test: BrandChip.
  - CI verde con 17+ test (~10 nuovi in F1.1).
  - Commit range: `28f3f42..HEAD` su `feature/f1-1-layout-shell`.
  - Prossimo sotto-cantiere F1.2: brand kit reale (editing tono, colori, parole bandite, contesto strategico).
```

Sposta "Adesso" a:

```markdown
## Adesso

- Nessun task di codice in corso. Prossima decisione: F1.2 brand kit editabile OR merge F1.1 in main OR fermarsi qui.
```

- [ ] **Step 5: Verifica CI finale una volta ancora**

```bash
cd app
npm run ci
```

- [ ] **Step 6: Commit di chiusura F1.1**

```bash
git add docs/diario.md
git commit -m "RQ-7: chiusura F1.1 layout UI + shell, aggiornamento diario"
```

---

## Autoverifica del piano

### Copertura spec

| Sezione spec | Task |
|---|---|
| §1 Contesto e vincoli | Global Constraints in intestazione |
| §2 Stack e dipendenze | Task 1, 2, 3 (setup progressivo) |
| §3 Palette e tipografia | Task 1 (palette + font) |
| §4 Navigazione e layout | Task 5 (AppShell + Header + Sidebar + UserMenu), Task 4 (BrandSwitcher) |
| §5 Le 6 pagine | Task 6 (landing + login), Task 8 (dashboard), Task 9 (marchi), Task 10 (audit), Task 11 (impostazioni) |
| §6 Interazione DB + moduli | Task 7 (m12-daily-use nuovo), Task 5 (riuso adapter), Task 10 (consumo m11) |
| §7 Cookie brand scope | Task 4 (scope.ts + BrandSwitcher) |
| §8 Componenti UI riusabili | Task 3 (BrandChip), Task 5 (layout), Task 8 (dashboard components) |
| §9 Loading + errori | Task 8, 9, 10, 11 (ognuno crea loading + error) |
| §10 Configurazione e file | Task 1, 2, 3 (tailwind, shadcn, vitest config) |
| §11 CI + DoD | Task 12 (verifica finale) |

### Placeholder scan

Nessun "TBD", "TODO", "implementa dopo". Ogni step ha codice concreto e comandi eseguibili. Le note su F0-b sono marcate esplicitamente come fuori scope, non come parti mancanti.

### Type consistency

- `BrandSlug = "lenny" | "stazione" | "eni-cafe" | "officina"` — usato coerentemente in Task 3, 4, 8, 9.
- `DashboardStats` — definito in Task 7, consumato in Task 8 con proprietà accurate (`toDo.contentsPending`, `going.brands`, ecc.).
- `Environment = "sviluppo-locale" | "staging" | "produzione"` — definito in Task 7, usato in Task 8 (`EnvironmentBadge`).
- `AuditEventRow` — definito in F0 modulo m11-admin, consumato in Task 10.

Signature consistenti verificate. Nessun mismatch.

---

## Consegna esecuzione

Piano salvato in `docs/superpowers/plans/2026-09-08-f1-1-layout-shell.md`.

Due modalità di esecuzione:

1. **Subagent-Driven (raccomandata)** — dispatch di un subagente fresco per ogni task, revisione tra un task e l'altro. Sub-skill: `superpowers:subagent-driven-development`.
2. **Inline Execution** — esecuzione in questa sessione con checkpoint. Sub-skill: `superpowers:executing-plans`.

Per F1.1 dove l'utente vuole vedere il risultato in browser al termine, Subagent-Driven è ideale — la CI (`npm run ci`) è il gate oggettivo tra task e il test finale è il tour manuale nel browser (Task 12 Step 3).
