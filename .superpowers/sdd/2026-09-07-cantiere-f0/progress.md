# SDD ledger — plan: docs/superpowers/plans/2026-09-07-cantiere-f0.md

Branch: feature/cantiere-f0 (creato da main)
Base commit: 2162e6d (scaffold Streamlit prototype — unico commit su main)
Modalità: subagent-driven, esecuzione continua fino a BLOCKED o completamento.

## Contesto per ripresa dopo compaction

- Repo locale, non ancora su GitHub. Nessun push finché F0-b.
- Il prototipo Streamlit vive isolato sul branch `prototype/streamlit` (15 commit), NON deve essere toccato durante F0.
- Docker Desktop richiesto dal Task 4 in poi.
- Convenzioni commit: `<IDs>: <descrizione italiano>` (es. `RS-1 RS-8: prima migrazione`).

## Global constraints presi dal piano

RQ-1 (ID nei commit), RQ-1a (CLAUDE.md deliverable), RQ-7 (TS strict, lint, test, CI verde),
RS-1 (confini modulo verificati in CI), RS-2 (adapter no SDK diretti), RS-3 (invarianti in DB),
RS-5 (config con storico), RS-6 (convenzionalità), RS-8 (migrazioni versionate),
RN-87 (organization_id ovunque), RNF-1 (no segreti in repo), RU-3 (Owner con 2FA).

## Log

- Task 1: complete (commits 2162e6d..658313a, review clean)
- Task 1: minor (deferred): "Da non dimenticare" bullet 3 di docs/diario.md ora stale (l'azione è stata compiuta in questo task) — potare alla prossima revisione diario.
- Task 1: minor (deferred): CLAUDE.md sezione "Convenzioni" contiene ancora "Struttura delle cartelle: si fissa al primo commit di F0 e si annota qui." — ora ridondante rispetto alla nuova sezione "## Struttura del repository". Rimuovere in una prossima passata cleanup.
- Task 2: implementer report DONE_WITH_CONCERNS; commit 67a6874. Concerns dichiarati:
  (a) plan typo: `noPropertyAccessFromIndexSignatures` (plurale) → il flag corretto è `noPropertyAccessFromIndexSignature` (singolare). Implementer ha corretto; da riflettere nel piano al Task 10.
  (b) Next.js 16.3.4 auto-genera `app/AGENTS.md` e `app/CLAUDE.md` — committati come inerti. Rischio di confusione con `CLAUDE.md` alla root che è autoritativo. Da giudicare al review.
  (c) `paths` alias `@/*` presente in `app/tsconfig.json` anche con `--no-import-alias` — comportamento di Next 16. Neutrale (Task 6+ lo useranno).
- Task 2: fix round 1/5 (3 addressed, 0 open — typecheck script, rimozione app/CLAUDE.md, rimozione page.module.css; commit ea11813).
- Task 2: complete (commits 658313a..ea11813, review clean).
- Task 2: minor (deferred): SVG assets in `app/public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) non riferiti dal `page.tsx` minimo. Cleanup nel final review o quando arriva UI vera in F1.
- Task 10 pre-note: aggiornare il piano F0 riflettendo il typo corretto `noPropertyAccessFromIndexSignature` (singolare) e la nuova sequenza di commit Task 2 (2 commit invece di 1: scaffolding + fix).
- Task 3: complete (commits ea11813..e0bebe7, review clean). Una deviazione motivata: `!.env.local.example` in `app/.gitignore` per negare `.env*` di Next 16 e permettere il versionamento del template.
- Task 4: PAUSED → RESUMED. Docker Desktop era installato ma spento. Utente lo ha avviato manualmente; `docker info` risponde `Server: 29.1.3`. Procedo con Task 4.
- Task 4: implementer DONE_WITH_CONCERNS (commit 34a592f). Ambiente Windows con Hyper-V ha porte 54315-54414 riservate → **remap porte**: API=54520, DB=54521, Studio=54522, SMTP=54523, Analytics=54524. Aggiornati `config.toml` e `.env.local.example` verbatim.
- Task 4: fix round 1/5 (1 addressed, 0 open — pooler port 54329→54525 fuori range Hyper-V; commit cf0b435).
- Task 4: complete (commits e0bebe7..cf0b435, review clean).
- **PORTE CORRETTE PER TASK 5-10** (i brief nel piano hardcodavano 54321/54322/54323): API 54520, DB 54521, Studio 54522. I subagenti dei task futuri devono usare queste porte reali, prendendo i valori da `app/.env.local` o `app/supabase/config.toml`.
- Task 4: minor (deferred): `pg_dump` non su PATH — Task 9 (backup) userà `npx supabase db dump` invece di `pg_dump` diretto. Alternativa: installare postgresql-client via scoop.
- Task 4: minor (deferred): `psql` non su PATH — Task 5, 6, 7 devono usare `npx supabase db query` o esecuzione via Studio invece di `psql` diretto per query di verifica; per seed via SQL file usare `supabase db reset` (che riesegue tutte le migrazioni + seed).
- Task 5: implementer DONE_WITH_CONCERNS (commit 54e89b1). **PLAN DEFECT critico corretto in loco**: convenzione migrations del brief (`YYYYMMDD_NNNNNN_name.sql`) causa collisione version-key in Supabase CLI v2.116 — tutte le migrations rinominate a `YYYYMMDDNNNNNN_name.sql` (14 cifre continue, nessun underscore nel prefisso). Task 7 deve usare `20260907000005_audit_events.sql`.
- Task 5: review Approved con 2 Important (I-1 TDD RED evidence missing, I-2 double dotenv) + 2 Minor (M-1 missing serviceKey guard, M-2 vitest v2 pin). Security review automatico separato ha aggiunto 3 findings: 1 Critical (RLS su users_profile) + 2 High (RLS su brands+organizations, MFA trigger self-attestazione).
- Task 5: fix round 1/5 (5 addressed, 0 open — RLS baseline denial-by-default via nuova migrazione `_000007_`, commento chiarificatore su trigger MFA con marker F0-predisposition, rimozione double dotenv in ci.sh, guard su serviceKey in test; commit d484658). I-1 (TDD RED evidence missing) è process gap non riscrivibile ex-post: deferito. M-2 (vitest v2 pin) note only.
- Task 5: complete (commits cf0b435..d484658, review clean).
- **PER TASK 6**: il piano al Task 6 diceva "In F0 non ci sono RLS ancora attive: cambia in F1" — questo è **ora FALSO**. RLS attiva su tutte e 3 le tabelle F0 con denial-by-default. Il codice Task 6 usa `getAdminClient()` (service_role) che bypassa RLS → nessun impatto funzionale, ma il commento va aggiornato ("le RLS sono già attive con denial-by-default; l'admin client bypassa via service_role; le policy select autenticate arriveranno in F1").
- **Task 5 F0-b deferred**: `enforce_owner_mfa()` in F0 controlla `requires_mfa` self-attestato; upgrade F0-b agganciarlo a `auth.mfa_factors` (commento SQL in loco già annotato).
- Task 5 out-of-scope observation: commit message fix round non elenca RN-87/RF-2.1/RU-1 pur essendo requisiti toccati (denialbdefault). Note only, IDs comunque nei file.
- Task 6: implementer DONE_WITH_CONCERNS (commit 5c3f778). 6 concerns dichiarati incluso: `@/` alias è `@/lib/...` non `@/src/lib/...`; `ON CONFLICT (email)` su auth.users non funziona → usato Admin REST API in dev-create-owner.sh; `npx supabase db query` no multi-statement; `db reset` invalida owner (attrito operativo); browser E2E non testato.
- Task 6: review Approved con 1 Important (I1 dev-create-owner non valida REST response) + 3 Minor (M1 workflow reminder, M2 login copy sbagliata, M3 admin.ts singleton pattern).
- Task 6: fix round 1/5 (3 addressed + 1 bonus, 0 open — validazione REST con exit 1, note incrociate ci.sh↔dev-create-owner, login copy corretta; bonus: pattern grep idempotenza corretto con `[[:space:]]*`; commit 8aac814). I2 (narrowing session.ts) e M3 (singleton) note only.
- Task 6: complete (commits d484658..8aac814, review clean).
- **PER TASK 7**: (a) Migrazione audit_events deve usare naming `20260907000005_audit_events.sql` (14 cifre no underscore); (b) aggiungere `alter table public.audit_events enable row level security` e `revoke insert on public.audit_events from anon, authenticated` come parte della stessa migrazione — coerente con strategia denial-by-default del Task 5 fix; l'admin client bypassa (test funzionano); (c) porte reali 54520/54521; (d) test usa `expect(error?.message.toLowerCase()).toMatch(...)` — il messaggio del trigger `audit_events is append-only (RF-11.3)` matcherà `/append-only/`.
- Task 7: implementer DONE (commit 383025c). 1 concern: `as any` su `.insert()` per mancanza di tipi generati Supabase (accettabile in F0, F1 rigenerare con `supabase gen types`). TDD RED evidence catturata (colma la lacuna del Task 5).
- Task 7: review Approved con 2 Important (I1 actor_kind:string invece di ActorKind; I2 mancava grant esplicito su service_role) + 3 Minor (M3 JSDoc, M4 CREATE OR REPLACE convention, M5 TRUNCATE gap).
- Task 7: fix round 1/5 (4 addressed, 0 open — ActorKind narrowing, grant esplicito service_role, JSDoc, commento TRUNCATE; commit c746111). M4 skip (convention only).
- Task 7: complete (commits 8aac814..c746111, review clean).
- **PER TASK 8**: (a) primo modulo M11 con `public.ts` che esporta `getRecentAuditEvents` importando da `lib/db/admin.ts` — quest'ultima è dentro `lib/`, NON è un modulo. Le regole dep-cruiser vanno formulate per: (i) proibire import da `src/modules/X/internal/` da fuori `src/modules/X/`; (ii) proibire cross-module import di internal; (iii) proibire import da `src/modules/X/*` fuori da `X/public.ts`. NON proibire import da `src/lib/`. Il pattern del brief va bene. (b) il probe temporaneo nei test — attenzione al path Windows con `(protected)`: la cartella `src/app/(protected)/` ha parentesi tonde che possono confondere alcuni tool. Meglio creare il probe in `src/app/probe-rs1.ts` alla root di `src/app/` come suggerito dai passi del brief (Step 4-5). (c) `chmod +x` non serve (nessun bash script nuovo in Task 8).
- Task 8: implementer DONE_WITH_CONCERNS (commit 91c37d7). 3 concerns: modules-must-expose-public omessa per limite backreference dep-cruiser v18 (autorizzato); cross-module-internal-forbidden semplificata (rischio falso positivo con alias); public.ts loophole nel brief corretto in loco.
- Task 8: review Approved con 2 Important (I1 commento TODO troppo vago su alias, I2 npm run ci non eseguito end-to-end) + 3 Minor (M1 versione dep-cruiser, M2 module-root loophole, M3 depcruise vs npx).
- Task 8: fix round 1/5 (3 addressed, 0 open — commento I1 esteso, npm run ci verificato exit 0 con boundaries step verde, TODO M1 cita versione; commit b36f11f). M2 accettato F0, M3 skip.
- Task 8: complete (commits c746111..b36f11f, review clean).
- **PER TASK 9**: (a) `pg_dump` NON su PATH — usare `npx supabase db dump` (wrapper CLI); (b) `psql` NON su PATH — per RIPRISTINO usare `docker exec <supabase_db_container> psql -U postgres -d postgres -f -` (leggere il container name da `docker ps --filter "name=supabase_db"`); (c) porte reali 54520/54521 non 54321/54322 anche nel backup script; (d) runbook-backup.md e runbook-primo-owner.md sono creati QUI (Task 9), NON in Task 6; (e) il ciclo probe→backup→drop→restore→verify DEVE essere eseguito in verifica per soddisfare criterio di uscita F0 "ripristino backup provato"; (f) il piano diceva `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres"` per drop — usare invece `npx supabase db reset` per ripulire, poi ripristinare dal dump via docker exec psql; ALTERNATIVA più pulita: `docker exec` accetta direttamente pipe stdin, il dump può essere piped in.
- Task 9: implementer DONE con 1 concern (commit 6b9ce21). `npx supabase db dump --local` non produce dump combinato schema+dati — usato `docker exec pg_dump` come fallback autorizzato. Container `supabase_db_app` confermato.
- Task 9: review Approved con 3 Important (I1 container name origin, I2 CONTAINER var estratta, I3 WHY docker in runbook) + 3 Minor (M4 empty dump guard, M5 primo-owner nota blocco intero, M6 DROP SCHEMA IF EXISTS).
- Task 9: fix round 1/5 (6 addressed, 0 open — tutti; commit 92d9dae).
- Task 9: complete (commits b36f11f..92d9dae, review clean).
- **PER TASK 10**: (a) `ci.sh` finale — riorganizzare in versione ordinata coerente; (b) aggiornare CLAUDE.md con nota "npm run ci prima di commit"; (c) aggiornare `docs/diario.md` riflettendo F0 completato (spostare "Adesso" a "Fatto", aggiungere elenco di tutto ciò che è stato fatto); (d) aggiornare il piano F0 (`docs/superpowers/plans/2026-09-07-cantiere-f0.md`) per riflettere i fix strutturali sopravvenuti: (i) tsconfig `noPropertyAccessFromIndexSignature` (singolare) invece di plurale; (ii) migration naming `YYYYMMDDNNNNNN_name.sql` (14 cifre no underscore); (iii) porte 54520/54521/54522 su questa macchina; (iv) `pg_dump`/`psql` non su PATH → soluzioni via `docker exec` e `supabase db query`; (v) `@/lib/...` non `@/src/lib/...`; (vi) RLS attiva denial-by-default (non "in F0 non ci sono RLS"); (vii) `on conflict (email)` su auth.users non funziona → Admin REST API; (viii) doppio dotenv rimosso; (e) potatura minor deferiti Task 1: bullet "Da non dimenticare" #3 obsoleto e riga Convenzioni "Struttura delle cartelle: si fissa al primo commit" ridondante.
- Task 10: implementer DONE (commit dbdbde4). Ottimizzazioni: seed reload psql omesso perché seed è ora migrazione numerata; guard `.env.local`/`supabase status` spostato in cima; retrospettiva 9 punti nel piano.
- Task 10: review Approved con 1 **Critical** (CLAUDE.md linea naming migrations ancora broken) + 1 Important (transient Docker flake non annotato in ci.sh) + 2 Minor (source .env.local omission comment, plan file righe 131/247 lens-not-rewrite accettato).
- Task 10: fix round 1/5 (3 addressed, 0 open — CLAUDE.md naming migrations corretto con esempio + spiegazione CLI ≥2.116; ci.sh nota Docker flake + nota source .env.local; commit a6faf48). Plan file lines skip (retrospettiva è il lens).
- Task 10: complete (commits 92d9dae..a6faf48, review clean).

---

## Cantiere F0-locale — chiuso 8 set 2026

- 18 commit su `feature/cantiere-f0` (base 2162e6d).
- Deliverables F0-locale completati: docs riordinati; Next.js+TS strict; Prettier + `npm run ci` (6 passi verdi); Supabase locale via CLI; modello dati organizations/brands/users_profile con invarianti in DB (RS-3); RLS baseline denial-by-default; adapter Supabase (RS-2); auth minimale con Owner+MFA predisposto; audit log append-only (RF-11.3) via trigger DB + helper logAuditEvent; RS-1 confini modulo con dependency-cruiser + primo modulo M11 come caso di test; backup+restore locali provati end-to-end (RQ-5, RNF-3); 4 file di test invarianti, 8 test PASS.
- Prossimo: final whole-branch review + finishing-a-development-branch (merge in main + eventuale apertura F0-b col cloud + GitHub).

## Final whole-branch review — 8 set 2026

- Reviewer: opus. Verdict: **Ready to merge with 5 Important-tier fixes**. 0 Critical.
- Findings I1..I5: env var names in README, versione Supabase CLI ≥2.116, middleware.ts SSR mancante (RS-6 gap), count "22 commit" errato, layout.tsx scaffold defaults.
- Fix wave (commit 1f41423): tutti e 5 addressed in un unico commit. Middleware I3 risolto con option (a) — wrapper `lib/db/middleware.ts` preserva RS-2. Nessun weakening di dep-cruiser. Branch ora 19 commit.
- Scoped re-review: tutti ADDRESSED, nessun new breakage.

**BRANCH READY TO MERGE INTO main.** F0-locale completato.
