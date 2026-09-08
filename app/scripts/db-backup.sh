#!/usr/bin/env bash
set -euo pipefail

# RNF-3: backup del DB locale. Dump SQL completo (schema + dati) dello schema public.
# Scrive in ./backups/regia-YYYYMMDD-HHMMSS.sql (cartella ignorata da git).
# Approccio: docker exec pg_dump (non 'supabase db dump'): il CLI non fa schema+dati insieme.
# Su cloud (F0-b) l'analogo scriverà su storage cifrato remoto con retention configurabile.

# Container Supabase DB locale.
# Nome derivato dal Supabase CLI: supabase_db_<projectId>.
# Il projectId è definito in supabase/config.toml (campo [project].project_id;
# di default = nome della directory del progetto). Se il projectId cambia,
# aggiornare CONTAINER qui e in db-restore.sh (o viceversa).
CONTAINER="supabase_db_app"

cd "$(dirname "$0")/.."
mkdir -p backups
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTFILE="backups/regia-${TIMESTAMP}.sql"

echo "==> Dump del DB locale in ${OUTFILE}"
if ! docker exec "${CONTAINER}" pg_dump \
  -U postgres -d postgres \
  --schema=public \
  --no-owner \
  --no-privileges \
  > "${OUTFILE}"; then
  echo "ERRORE: pg_dump fallito. Container '${CONTAINER}' accessibile?" >&2
  rm -f "${OUTFILE}"
  exit 1
fi

if [ ! -s "${OUTFILE}" ]; then
  echo "ERRORE: dump vuoto o pg_dump non ha prodotto output. Container '${CONTAINER}' accessibile?" >&2
  rm -f "${OUTFILE}"
  exit 1
fi

BYTES=$(wc -c < "${OUTFILE}" | tr -d ' ')
echo "==> Fatto: ${BYTES} byte — ${OUTFILE}"
