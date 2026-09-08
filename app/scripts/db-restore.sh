#!/usr/bin/env bash
set -euo pipefail

# RQ-5: ripristino da dump. Distruttivo: droppa lo schema public e ricrea da dump.
# NON usare su altro che il DB locale.
# Usa docker exec psql (il container supabase_db_app espone psql).

# Container Supabase DB locale.
# Nome derivato dal Supabase CLI: supabase_db_<projectId>.
# Il projectId è definito in supabase/config.toml (campo [project].project_id;
# di default = nome della directory del progetto). Se il projectId cambia,
# aggiornare CONTAINER qui e in db-backup.sh (o viceversa).

if [ $# -ne 1 ]; then
  echo "Uso: $0 <path-al-dump.sql>" >&2
  exit 2
fi

DUMP="$1"
if [ ! -f "${DUMP}" ]; then
  echo "File non trovato: ${DUMP}" >&2
  exit 2
fi

CONTAINER="supabase_db_app"

echo "==> ATTENZIONE: sto per droppare lo schema public del DB locale e ripristinarlo da dump."
echo "    Container target: ${CONTAINER}"
read -r -p "    Confermi digitando SI: " CONFIRM || true
if [ "${CONFIRM}" != "SI" ]; then
  echo "Annullato."
  exit 1
fi

echo "==> Drop schema public"
docker exec "${CONTAINER}" psql -U postgres -d postgres \
  -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

echo "==> Restore da ${DUMP}"
docker exec -i "${CONTAINER}" psql -U postgres -d postgres < "${DUMP}"

echo "==> Fatto."
