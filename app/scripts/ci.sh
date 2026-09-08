#!/usr/bin/env bash
set -euo pipefail

# CI locale — equivalente della pipeline che gireremo su GitHub Actions in F0-b.
# Prerequisiti:
#   - Docker Desktop attivo
#   - Supabase locale avviato (npx supabase start) con le credenziali in .env.local
# Ogni passo è indipendente ed esce a errore alla prima violazione.

# Env vars sono caricati da dotenv-cli dentro `npm test` (script `test` in
# package.json). Non fare `source .env.local` qui: causerebbe doppio caricamento
# con dotenv-cli e potenziali conflitti (vedi Task 5 fix round).
if [ ! -f .env.local ]; then
  echo "!! .env.local mancante. Copia .env.local.example e riempi." >&2
  exit 1
fi

if ! npx supabase status >/dev/null 2>&1; then
  echo "!! Supabase locale non attivo. Esegui: npx supabase start" >&2
  exit 1
fi

echo "==> 1/6  Lint (ESLint)"
npm run lint

echo "==> 2/6  Formattazione (Prettier check)"
npm run format:check

echo "==> 3/6  Typecheck (TypeScript strict)"
npm run typecheck

echo "==> 4/6  Confini di modulo (RS-1, dependency-cruiser)"
npx depcruise src --config .dependency-cruiser.cjs

echo "==> 5/6  Migrazioni idempotenti (RS-8, supabase db reset)"
# Applica tutte le migrazioni su un DB locale pulito. Se una migrazione
# non è idempotente rispetto al reset o rompe lo schema, fallisce qui.
# Il seed dati è incluso nella migrazione 000006: non serve un passo separato.
# Nota: dopo il reset auth.users è svuotato; riesegui dev-create-owner.sh per ricreare l'Owner.
# Nota: su Windows con Docker Desktop + Hyper-V, `supabase db reset` a caldo
# subito dopo un reset precedente può fallire con timeout Docker (~1 min).
# Rimedio: attendere 5-10 secondi e rieseguire `npm run ci`. Non riproducibile
# su Linux nativo (GitHub Actions, F0-b).
npx supabase db reset --no-seed >/dev/null

echo "==> 6/6  Test invarianti + boundaries (Vitest)"
npm test

echo ""
echo "==> CI locale verde ✓"
echo "    Puoi committare."
