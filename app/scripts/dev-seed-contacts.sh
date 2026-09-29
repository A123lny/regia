#!/usr/bin/env bash
set -euo pipefail

# Seed dev contatti (M1 Data Hub). Idempotente.
# Cancella e reinsersisce solo i contatti taggati 'seed-dev'.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/dev-seed-contacts.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "!! $SQL_FILE mancante." >&2
  exit 1
fi

echo "==> Applico seed contatti dev su DB locale..."
cd "$SCRIPT_DIR/.."
npx supabase db query --local -f "$SQL_FILE"
echo "==> Fatto."
