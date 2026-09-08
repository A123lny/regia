#!/usr/bin/env bash
set -euo pipefail

# RNF-3: backup del DB locale. Dump SQL completo (schema + dati) dello schema public.
# Scrive in ./backups/regia-YYYYMMDD-HHMMSS.sql (cartella ignorata da git).
# In locale usa docker exec pg_dump (il container supabase_db_app espone pg_dump).
# Su cloud (F0-b) l'analogo scriverà su storage cifrato remoto con retention configurabile.

cd "$(dirname "$0")/.."
mkdir -p backups
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTFILE="backups/regia-${TIMESTAMP}.sql"

echo "==> Dump del DB locale in ${OUTFILE}"
docker exec supabase_db_app pg_dump \
  -U postgres -d postgres \
  --schema=public \
  --no-owner \
  --no-privileges \
  > "${OUTFILE}"

BYTES=$(wc -c < "${OUTFILE}" | tr -d ' ')
echo "==> Fatto: ${BYTES} byte — ${OUTFILE}"
