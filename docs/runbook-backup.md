# Runbook — Backup e ripristino

> Riferimenti: RQ-5, RNF-3, criterio di uscita F0 (§12.3).

## Backup locale

```bash
cd app
bash scripts/db-backup.sh
```

Output: `app/backups/regia-YYYYMMDD-HHMMSS.sql`.
La cartella `backups/` è ignorata da git (`.gitignore`).
Il dump è prodotto da `docker exec supabase_db_app pg_dump` e include schema e dati dello schema `public`.

## Ripristino locale

**Attenzione: distruttivo. Solo su DB locale.**

```bash
cd app
bash scripts/db-restore.sh backups/regia-YYYYMMDD-HHMMSS.sql
```

Lo script chiede una conferma esplicita digitando `SI`. Droppa lo schema `public` e
lo ricrea interamente dal dump. Usa `docker exec -i supabase_db_app psql`.

Per bypassare la conferma interattiva (es. in automazione):

```bash
echo "SI" | bash scripts/db-restore.sh backups/regia-YYYYMMDD-HHMMSS.sql
```

## Verifica trimestrale (RNF-3)

Ogni tre mesi, almeno un ciclo backup → drop → restore → verifica dati, con
data annotata nel diario `docs/diario.md` alla voce "Fatto".

Ultima verifica in locale: **8 set 2026 (Task 9 del piano F0)**.
Prossima verifica prevista: **8 dic 2026**.

Procedura di verifica:

```bash
cd app

# 1) Partire da DB pulito
npx supabase db reset

# 2) Aggiungere una riga marcatore
docker exec supabase_db_app psql -U postgres -d postgres \
  -c "INSERT INTO public.audit_events (organization_id, actor_kind, action, details) \
      VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'system', 'backup.probe', \
      '{\"marker\":\"ciclo-trimestrale\"}');"

# 3) Backup
bash scripts/db-backup.sh
LAST=$(ls -t backups/*.sql | head -1)

# 4) Drop schema
docker exec supabase_db_app psql -U postgres -d postgres \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 5) Verifica che non ci siano tabelle
docker exec supabase_db_app psql -U postgres -d postgres \
  -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
# Atteso: 0

# 6) Restore
echo "SI" | bash scripts/db-restore.sh "${LAST}"

# 7) Verifica marcatore
docker exec supabase_db_app psql -U postgres -d postgres \
  -c "SELECT action, details->>'marker' AS marker FROM public.audit_events \
      WHERE action='backup.probe';"
# Atteso: una riga con marker ciclo-trimestrale
```

## Note per F0-b (cloud)

Quando la piattaforma sarà su ambiente vero (Supabase Pro + hosting scelto),
questa procedura diventa:

- Il backup è eseguito da Supabase (daily automatic, PITR entro RPO ≤ 24h).
- Il dump aggiuntivo va su storage cifrato remoto con retention configurabile.
- Il ripristino di prova gira su un ambiente `test` isolato, mai contro `produzione`.
- Il ciclo trimestrale resta dovuto e va documentato in diario.
