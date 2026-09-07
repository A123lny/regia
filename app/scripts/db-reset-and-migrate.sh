#!/usr/bin/env bash
set -euo pipefail

# Ricrea da zero il DB locale applicando tutte le migrazioni in ordine.
# Distruttivo: cancella ogni dato. Uso: preparazione test o dopo modifiche schema.
cd "$(dirname "$0")/.."
npx supabase db reset
