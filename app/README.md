# Regìa — piattaforma

Progetto Next.js + TypeScript + Supabase. Vedi `../docs/capitolato.md`.

## Sviluppo locale

Prerequisiti: Node ≥ 20, Docker Desktop in esecuzione, Supabase CLI ≥ 2.116.

```bash
# 1. Installa dipendenze
npm install

# 2. Avvia lo stack Supabase locale (Postgres + Auth + Storage + Studio)
npx supabase start

# 3. Applica le migrazioni
npx supabase db reset

# 4. Copia .env.local.example in .env.local e riempi con i valori stampati da 'supabase start'
cp .env.local.example .env.local
# poi editalo: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 5. Avvia Next.js
npm run dev
```

## Verifiche

```bash
npm run ci   # lint + typecheck + test + boundaries + migrate-check
```

Non usare `git push` finché il cantiere non arriva a F0-b (cloud + GitHub).

## Note sulle dipendenze

- **`lucide-react` serie 1.x**: la libreria di icone Lucide ha migrato dalla serie 0.x alla 1.x nel 2026. La versione corrente (`^1.42.0`) è la `dist-tags.latest` sul registry npm ufficiale, con repository `lucide-icons/lucide.git`. Automated security scanner con knowledge cutoff pre-migrazione possono falsamente segnalare la 1.x come sospetta — vedi verifica `npm view lucide-react dist-tags` per l'evidenza.
