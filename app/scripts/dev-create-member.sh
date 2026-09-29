#!/usr/bin/env bash
# dev-create-member.sh
# Crea un membro del team (editor) nel database Supabase locale.
# NON eseguire in produzione: solo ambiente locale F0.
#
# Uso:
#   cd app
#   bash scripts/dev-create-member.sh --email marketing@example.com --password segreta123 --role editor
#
# Variabili di ambiente / flag:
#   --email <email>     (obbligatorio)
#   --password <pwd>    (default: password123)
#   --role <role>       (default: editor; valori consentiti: editor)
#                       Per creare un owner usa dev-create-owner.sh (richiede MFA).
#   SEED_ORG_ID         (default: 00000000-0000-0000-0000-000000000001)
#   SUPABASE_URL        (default: http://127.0.0.1:54520)
#   SERVICE_ROLE_KEY    (letto da .env.local se presente)
#
# Nota RU-3: solo 'owner' richiede MFA (requires_mfa=true). Editor non ha MFA obbligatoria in F0.

set -euo pipefail

EMAIL=""
PASSWORD="password123"
ROLE="editor"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)    EMAIL="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    --role)     ROLE="$2"; shift 2 ;;
    *) echo "Flag sconosciuto: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$EMAIL" ]; then
  echo "ERRORE: --email obbligatorio. Uso:" >&2
  echo "  bash scripts/dev-create-member.sh --email marketing@example.com [--password X] [--role editor]" >&2
  exit 1
fi

if [ "$ROLE" != "editor" ]; then
  echo "ERRORE: --role deve essere 'editor'. Per 'owner' usa dev-create-owner.sh (richiede MFA)." >&2
  exit 1
fi

SEED_ORG_ID="${SEED_ORG_ID:-00000000-0000-0000-0000-000000000001}"
SUPABASE_URL="${SUPABASE_URL:-http://127.0.0.1:54520}"

if [ -f ".env.local" ] && [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  SERVICE_ROLE_KEY="$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2-)"
fi
SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU}"

echo "==> Verifica utente esistente: ${EMAIL}"
EXISTING=$(npx supabase db query "select id from auth.users where email = '${EMAIL}'" 2>/dev/null | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 || true)

if [ -n "${EXISTING}" ]; then
  echo "   Utente gia presente: ${EXISTING}. Salto creazione auth."
else
  echo "==> Creazione utente via Admin API..."
  RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"email_confirm\":true}" \
    || true)
  echo "   Risposta API: ${RESPONSE}"
  USER_ID=$(echo "${RESPONSE}" | grep -o '"id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | grep -o '"[^"]*"$' | tr -d '"' || true)
  if [ -z "${USER_ID}" ]; then
    echo "ERRORE: creazione utente fallita. Risposta REST:" >&2
    echo "${RESPONSE}" >&2
    exit 1
  fi
fi

echo "==> Collegamento profilo (role=${ROLE}, requires_mfa=false) in users_profile..."
npx supabase db query "insert into public.users_profile (user_id, organization_id, role, requires_mfa) select u.id, '${SEED_ORG_ID}'::uuid, '${ROLE}', false from auth.users u where u.email = '${EMAIL}' on conflict (user_id) do update set role = excluded.role"

echo "==> Verifica profilo:"
npx supabase db query "select up.user_id, up.role, up.organization_id, up.requires_mfa from public.users_profile up join auth.users au on au.id = up.user_id where au.email = '${EMAIL}'"

echo ""
echo "==> Membro pronto:"
echo "    Email:    ${EMAIL}"
echo "    Password: ${PASSWORD}"
echo "    Ruolo:    ${ROLE}"
echo "    Login:    http://localhost:3000/login"
