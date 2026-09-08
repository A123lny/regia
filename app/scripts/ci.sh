#!/usr/bin/env bash
set -euo pipefail

echo "==> Lint (ESLint)"
npm run lint

echo "==> Formattazione (Prettier check)"
npm run format:check

echo "==> Typecheck (TypeScript strict)"
npm run typecheck

echo "==> Confini di modulo (RS-1, dependency-cruiser)"
npx depcruise src --config .dependency-cruiser.cjs

echo "==> Verifica migrazioni (supabase db reset)"
# Applica tutte le migrazioni su un DB locale pulito. Se una migrazione
# non è idempotente rispetto al reset o rompe lo schema, fallisce qui.
npx supabase db reset --no-seed

echo "==> Test invarianti (Vitest)"
# I test si aspettano che Supabase locale sia attivo. Se non lo è, li saltiamo con warning.
if npx supabase status >/dev/null 2>&1; then
  npm test
else
  echo "   Supabase locale non attivo — test saltati. Esegui 'npx supabase start' e ripeti."
  exit 1
fi

# Nota per lo sviluppatore: supabase db reset ha svuotato auth.users
# durante la verifica migrazioni. Se vuoi rifare il login in locale,
# esegui: bash scripts/dev-create-owner.sh

echo "==> CI locale OK"
