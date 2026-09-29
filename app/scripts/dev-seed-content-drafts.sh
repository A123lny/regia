#!/usr/bin/env bash
# dev-seed-content-drafts.sh
# Popola public.content_drafts con dati fittizi per il tour visivo del calendario.
# NON eseguire in produzione: solo ambiente locale F0.
#
# Uso:
#   cd app
#   bash scripts/dev-seed-content-drafts.sh
#
# Idempotente: cancella prima tutti i draft marcati "[SEED]" poi reinserisce.
# Variabili di ambiente (opzionali):
#   SEED_ORG_ID    (default: 00000000-0000-0000-0000-000000000001)
#   OWNER_DEV_EMAIL (default: admin@admin.com — deve gia esistere, vedi dev-create-owner.sh)

set -euo pipefail

SEED_ORG_ID="${SEED_ORG_ID:-00000000-0000-0000-0000-000000000001}"
OWNER_DEV_EMAIL="${OWNER_DEV_EMAIL:-admin@admin.com}"

echo "==> Cancello draft [SEED] precedenti (idempotenza)..."
npx supabase db query "DELETE FROM public.content_drafts WHERE theme_input LIKE '[SEED]%'"

echo "==> Inserisco 24 draft di test distribuiti sui 4 marchi..."
npx supabase db query -f scripts/dev-seed-content-drafts.sql

echo "==> Verifica conteggi per stato:"
npx supabase db query "SELECT status, count(*) FROM public.content_drafts WHERE theme_input LIKE '[SEED]%' GROUP BY status ORDER BY status"

echo "==> Verifica distribuzione temporale programmati:"
npx supabase db query "SELECT to_char(scheduled_at, 'YYYY-MM-DD HH24:MI') AS quando, count(*) FROM public.content_drafts WHERE theme_input LIKE '[SEED]%' AND scheduled_at IS NOT NULL GROUP BY 1 ORDER BY 1"

echo "==> Seed content_drafts completato."
echo "    Ora ricarica /dashboard e /contenuti/calendario per vedere i dati."
