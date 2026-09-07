# Regìa — piattaforma

Progetto Next.js + TypeScript + Supabase. Vedi `../docs/capitolato.md`.

## Sviluppo locale

Prerequisiti: Node ≥ 20, Docker Desktop in esecuzione, Supabase CLI ≥ 2.98.

```bash
# 1. Installa dipendenze
npm install

# 2. Avvia lo stack Supabase locale (Postgres + Auth + Storage + Studio)
npx supabase start

# 3. Applica le migrazioni
npx supabase db reset

# 4. Copia .env.local.example in .env.local e riempi con i valori stampati da 'supabase start'
cp .env.local.example .env.local
# poi editalo: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 5. Avvia Next.js
npm run dev
```

## Verifiche

```bash
npm run ci   # lint + typecheck + test + boundaries + migrate-check
```

Non usare `git push` finché il cantiere non arriva a F0-b (cloud + GitHub).
