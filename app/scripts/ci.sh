#!/usr/bin/env bash
set -euo pipefail

echo "==> Lint (ESLint)"
npm run lint

echo "==> Formattazione (Prettier check)"
npm run format:check

echo "==> Typecheck (TypeScript strict)"
npm run typecheck

echo "==> Verifica migrazioni (supabase db reset)"
# Applica tutte le migrazioni su un DB locale pulito. Se una migrazione
# non è idempotente rispetto al reset o rompe lo schema, fallisce qui.
npx supabase db reset --no-seed

# I passi seguenti vengono aggiunti dai task successivi del piano F0:
#   - Task 10: test Vitest
#   - Task 10: boundaries dependency-cruiser (RS-1)

echo "==> CI locale OK"
