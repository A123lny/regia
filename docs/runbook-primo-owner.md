# Runbook — Creazione del primo Owner nel DB locale

> Riferimenti: RU-1, RU-3.

Al primo `supabase db reset` non esiste alcun utente in `auth.users`. Per usare
l'app in locale serve crearne uno con ruolo `owner`. In produzione (F0-b) questa
procedura si trasforma nell'invito via email dal pannello Supabase.

## Procedura

```bash
cd app
bash scripts/dev-create-owner.sh
```

Lo script crea un utente con email `owner@regia.local` e password `owner-dev-2026`
nella tabella `auth.users` e il relativo profilo con ruolo `owner` in `public.users_profile`.

Per usare email o password diverse, modifica le variabili nel file oppure esegui
manualmente:

**Importante**: eseguire l'intero blocco a partire da `EMAIL=...` — il heredoc
`<<SQL` interpola le variabili shell, quindi le assegnazioni all'inizio del
blocco sono obbligatorie.

```bash
cd app

EMAIL="owner@regia.local"
PASSWORD="owner-dev-2026"

docker exec -i supabase_db_app psql -U postgres -d postgres <<SQL
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated',
  '${EMAIL}',
  crypt('${PASSWORD}', gen_salt('bf')),
  now(), now(), now()
)
ON CONFLICT (email) DO NOTHING
RETURNING id;

INSERT INTO public.users_profile (user_id, organization_id, role, requires_mfa)
SELECT u.id, '00000000-0000-0000-0000-000000000001'::uuid, 'owner', true
FROM auth.users u
WHERE u.email = '${EMAIL}'
ON CONFLICT (user_id) DO NOTHING;
SQL
```

## Verifica

Accedi a http://localhost:3000/login con l'email e la password scelte.
Atteso: redirect a `/dashboard` che mostra `role: owner`.

## Dopo ogni `supabase db reset`

Il reset cancella tutti i dati di `auth.users`. Ripetere la procedura ogni volta
che si esegue `npx supabase db reset` o `bash scripts/db-reset-and-migrate.sh`.
