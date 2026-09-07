#!/usr/bin/env bash
set -euo pipefail

echo "==> Lint (ESLint)"
npm run lint

echo "==> Formattazione (Prettier check)"
npm run format:check

echo "==> Typecheck (TypeScript strict)"
npm run typecheck

# I passi seguenti vengono aggiunti dai task successivi del piano F0:
#   - Task 4: verifica idempotenza migrazioni Supabase
#   - Task 10: test Vitest
#   - Task 10: boundaries dependency-cruiser (RS-1)

echo "==> CI locale OK"
