#!/usr/bin/env bash
# dev-create-owner.sh
# Crea l'utente Owner di sviluppo nel database Supabase locale.
# NON eseguire in produzione: questo script è solo per l'ambiente locale F0.
#
# Uso:
#   cd app
#   bash scripts/dev-create-owner.sh
#
# Variabili di ambiente (opzionali — i default vanno bene per lo sviluppo locale):
#   OWNER_DEV_EMAIL    (default: owner@regia.local)
#   OWNER_DEV_PASSWORD (default: owner-dev-2026)
#   SEED_ORG_ID        (default: 00000000-0000-0000-0000-000000000001)
#   SUPABASE_URL       (default: http://127.0.0.1:54520)
#   SERVICE_ROLE_KEY   (letto da .env.local se presente, altrimenti default locale)
#
# Requisiti: npx supabase su PATH, curl su PATH, Supabase locale attivo.
# Nota: usa la REST Admin API di Supabase (POST /auth/v1/admin/users) per creare
# l'utente in auth.users in modo affidabile — auth.users non ha un unique su email
# accessibile via ON CONFLICT, quindi l'approccio SQL diretto non è portabile.
#
# Nota: 'npm run ci' esegue 'supabase db reset' che svuota auth.users.
# Rieseguire questo script dopo ogni CI per ripristinare l'utente di login dev.

set -euo pipefail

OWNER_DEV_EMAIL="${OWNER_DEV_EMAIL:-owner@regia.local}"
OWNER_DEV_PASSWORD="${OWNER_DEV_PASSWORD:-owner-dev-2026}"
SEED_ORG_ID="${SEED_ORG_ID:-00000000-0000-0000-0000-000000000001}"
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54520}"

# Legge SERVICE_ROLE_KEY da .env.local se disponibile
if [ -f ".env.local" ] && [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2-)"
fi
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"

echo "==> Verifica utente esistente: ${OWNER_DEV_EMAIL}"
EXISTING=$(npx supabase db query "select id from auth.users where email = '${OWNER_DEV_EMAIL}'" 2>/dev/null | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 || true)

if [ -n "${EXISTING}" ]; then
  echo "   Utente già presente: ${EXISTING}. Salto creazione."
else
  echo "==> Creazione utente Owner dev via Admin API..."
  RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${OWNER_DEV_EMAIL}\",\"password\":\"${OWNER_DEV_PASSWORD}\",\"email_confirm\":true}" \
    || true)
  echo "   Risposta API: ${RESPONSE}"
  USER_ID=$(echo "${RESPONSE}" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | grep -o '"[^"]*"$' | tr -d '"' || true)
  if [ -z "${USER_ID}" ]; then
    echo "ERRORE: creazione utente fallita. Risposta REST:" >&2
    echo "${RESPONSE}" >&2
    exit 1
  fi
fi

echo "==> Collegamento profilo Owner in users_profile (idempotente)..."
npx supabase db query "insert into public.users_profile (user_id, organization_id, role, requires_mfa) select u.id, '${SEED_ORG_ID}'::uuid, 'owner', true from auth.users u where u.email = '${OWNER_DEV_EMAIL}' on conflict (user_id) do nothing"

echo "==> Verifica utente in auth.users:"
npx supabase db query "select id, email from auth.users where email = '${OWNER_DEV_EMAIL}'"

echo "==> Verifica profilo in users_profile:"
npx supabase db query "select up.user_id, up.role, up.organization_id, up.requires_mfa from public.users_profile up join auth.users au on au.id = up.user_id where au.email = '${OWNER_DEV_EMAIL}'"

echo "==> Utente Owner dev pronto."
