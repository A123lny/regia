# M05 Publishing — Design v1

**Autore:** Andrea + Claude
**Data:** 29 settembre 2026
**Stato:** Design approvato — pronto per piano implementativo

## Scopo

Portare finalmente **Regìa** a pubblicare messaggi verso l'esterno. Oggi la piattaforma sa generare, approvare, programmare contenuti e voucher, ma non sa mandarli: niente esce dal DB. M05 v1 fornisce la spina dorsale per l'invio a **WhatsApp** (via Twilio) e **Email** (via Resend), con architettura estensibile ad altri canali (SMS, FB, IG, Google) senza refactor.

## Perché ora

- L'audit del capitolato del 25 set 2026 ha identificato M05 come **unico buco che impedisce la produzione**. Marketing (M2/M3/M4/M11/M12) e commerciale (M1/M6/M7/M9/M13) sono pronti "dentro Regìa", ma il canale di uscita non esiste.
- Il capitolato (RF-5.1..5.7 + RN-82 + RA-8.4) definisce con precisione l'architettura: adapter per canale, coda idempotente con retry/dead-letter, log immutabile con snapshot, fasce orarie configurabili, costo stimato prima dell'invio, WhatsApp riservato a utilità (RF-5.5a).
- Le fondamenta sono in casa: Supabase Vault già attivo su Cloud, M11 admin ha già kill switch AI + tetti spesa che estendiamo, M02 ha già `brand_email_identity` (from/reply-to), M01 ha già consent per canale (RF-1.4).

## Requisiti coperti da v1

| ID | Descrizione | Come |
|---|---|---|
| RF-5.1 | Architettura adapter, interfaccia comune | `PublishAdapter` interface (RS-2) |
| RF-5.2 | Canali WA + Email | `TwilioWhatsAppAdapter` + `ResendEmailAdapter` |
| RF-5.3 | Email tramite servizio dedicato | Resend |
| RF-5.4 | WhatsApp tramite provider autorizzato, template pre-approvati, consenzienti | Twilio + WA Business Templates + gate consent |
| RF-5.5 | Coda con retry, idempotenza, stato singolo, notifica fallimento | `m05_publish_jobs` + SKIP LOCKED + backoff exp + dead-letter |
| RF-5.5a | WhatsApp riservato a utilità | Flag `allow_promotional=false` su canale WA in `m05_channel_config` |
| RF-5.6 | Fasce orarie configurabili | `quiet_hours_start/end` + gate `send_after` |
| RF-5.7 | Log pubblicazione immutabile con snapshot | `m05_publish_log` + trigger anti-UPDATE (RS-3) |
| RA-8.4 | Max 2 messaggi commerciali/mese/persona | `max_per_month_per_contact` + gate 4 |
| RA-8.6 | Codice dispone, non modello | Gate 1-6 obbligatori in `sendMessage` |
| RF-1.4 | Consensi separati per canale | Gate 1 verifica `contact_consents` |
| RS-2 | Dominio dipende da adapter, non da SDK | `PublishAdapter` è porta unica |
| RS-3 | Invarianti in DB | UNIQUE(org,dedupe_key) + trigger append-only su log |
| RS-4 | Asincrono disciplinato | Coda + idempotenza + retry + dead-letter |
| RS-8 | Schema via migrazioni versionate | 1 migrazione `m05_publishing.sql` |

## Fuori scope v1 (rimandato a v2/v3)

- RN-62 protezioni invii massivi (preview + digitare numero + invio prova + partenza scaglionata): richiede UI complessa e flow di conferma, sensato solo quando si integrano campagne (M07). Sostituito in v1 dal vincolo pratico: `sendMessage` v1 accetta 1 destinatario alla volta.
- RN-63 messaggio di benvenuto: dipende da integrazione M10 signup, non in v1.
- RN-64..67 disiscrizione con scelta canale + motivo + "scrivetemi meno" + allarme "troppi messaggi": mini-sottosistema autonomo, arriva in v2 dedicato.
- RF-5.2 estensione a SMS/FB/IG/Google: fase successiva, pattern adapter già predisposto.
- UI log viewer (`/pubblicazioni`): in v1 il log si consulta via SQL editor. Viewer arriva quando i volumi lo giustificano.
- Template management UI Twilio: template si creano su Twilio Console e si linkano via `template_sid` nel config JSON. Editor visuale è overhead.
- Retry manuale dead jobs da UI: in v1 basta cambiare `status` da SQL editor. Feature UI arriva quando serve davvero.
- RN-82 costo stimato UI: metodo `estimateCost()` esiste sull'adapter e valorizza `m05_publish_jobs.cost_estimate_cents` per audit, ma nessuna UI la mostra all'utente prima dell'invio. Arriva insieme a RN-62.

## Global Constraints

- **Nessun secret in env**: le API keys Twilio/Resend vivono in `vault.secrets`, referenziate via `vault_secret_id` in `m05_channel_credentials`. Server decrypta al momento dell'invio via `service_role` + `vault.decrypted_secrets`.
- **Nessuna dipendenza cross-modulo in v1**: M05 non importa M03/M06/M07/M09. Loro chiameranno `m05-publishing/public.ts` in v2. RS-1 compliance verificata in CI via dep-cruiser.
- **Un provider per canale in v1**: Twilio per WA, Resend per Email. Il codice per un secondo provider è implementazione di `PublishAdapter`, non refactor. La UI credenziali mostra dropdown con un solo valore per adesso.
- **Nessun invio massivo**: `sendMessage()` accetta 1 recipient. Bulk arriva con RN-62 in v2.
- **Kill switch specifico per canale** (`assertPublishEnabled(channel)`): distinto da `assertAiEnabled` di M11. Owner può spegnere WA senza fermare AI o email.

## Architettura complessiva

### Confini modulo (RS-1)

```
m05-publishing/
├── public.ts
│   ├── sendMessage(input): Promise<Job>
│   ├── enqueueBatch(inputs[]): Promise<Job[]>  (v1: cap 10 per non collidere con bulk)
│   ├── getJobStatus(jobId): Promise<JobStatus>
│   ├── retryDeadJob(jobId): Promise<Job>  (Owner-only)
│   ├── assertPublishEnabled(channel): void  (usato da caller per verifica pre-flight)
│   ├── (types) PublishInput, Job, JobStatus, PublishError, CostEstimate
│   └── (labels) CHANNEL_LABELS, STATUS_LABELS
└── internal/
    ├── types.ts              # Adapter interface + shared types
    ├── adapter-twilio.ts     # TwilioWhatsAppAdapter
    ├── adapter-resend.ts     # ResendEmailAdapter
    ├── adapter-registry.ts   # factory getAdapter(channel, provider)
    ├── credentials-repo.ts   # CRUD channel_credentials + Vault ops
    ├── channel-config-repo.ts # CRUD channel_config (quiet hours, limits)
    ├── publish-jobs-repo.ts  # enqueue/claim/markSent/markFailed
    ├── publish-log-repo.ts   # append-only log
    ├── gates.ts              # 6 gate: consent, enabled, quiet, pressure, governance, budget
    ├── worker.ts             # tickBatch(): claim + execute + finalize
    ├── actions.ts            # server actions per UI M11 admin
    └── (helpers)
```

### Interfaccia adapter (RS-2)

```typescript
export interface PublishAdapter {
  readonly channel: Channel
  readonly provider: string

  /** Invia il messaggio, ritorna externalId per tracking. Errori tipizzati. */
  send(input: OutgoingMessage): Promise<{ externalId: string; costCents: number }>

  /** Verifica connettività + credenziali. Chiamato dal bottone "Test" in UI. */
  ping(): Promise<{ ok: true } | { ok: false; error: string }>

  /** Stima costo prima dell'invio. Usato in gate 6 (budget). */
  estimateCost(input: OutgoingMessage): Promise<number>  // in centesimi

  /** Recupera stato invio dal provider. Usato da webhook handler. */
  getStatus(externalId: string): Promise<'sent' | 'delivered' | 'failed' | 'unknown'>
}

export type OutgoingMessage =
  | { channel: 'email'; to: string; subject: string; html: string; text?: string; from: string; replyTo?: string }
  | { channel: 'whatsapp'; to: string; templateSid: string; variables: Record<string, string>; from: string }
```

### Schema DB (RS-8)

Nuova migrazione: `app/supabase/migrations/20260929000001_m05_publishing.sql`.

**5 tabelle nuove**, tutte con `organization_id` (RN-87) e RLS denial-by-default.

#### `m05_channel_credentials`
```sql
create table m05_channel_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  channel text not null check (channel in ('email','whatsapp','sms','facebook','instagram','google')),
  provider text not null,  -- 'resend','twilio' in v1
  vault_secret_id uuid not null,  -- FK logica a vault.secrets
  config jsonb not null default '{}',  -- account_sid, from_number, from_email (non-secret)
  enabled boolean not null default false,
  verified_at timestamptz null,
  last_test_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel)  -- 1 provider per canale in v1
);
```

#### `m05_channel_config`
```sql
create table m05_channel_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  channel text not null,
  quiet_hours_start time not null default '09:00',
  quiet_hours_end time not null default '21:00',
  allow_promotional boolean not null default true,
  max_per_month_per_contact int not null default 2,
  created_at, updated_at,
  unique (organization_id, channel)
);
-- Default seed: WA -> quiet 9-21, allow_promotional=false (RF-5.5a).
--               Email -> quiet 0-24 (nessuna quiet), allow_promotional=true, max/mese=4.
```

#### `m05_publish_jobs`
```sql
create table m05_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  channel text not null,
  provider text not null,
  recipient_contact_id uuid null references contacts(id),
  recipient_address text not null,  -- email o E.164 phone
  source_kind text not null check (source_kind in ('test','reminder','voucher','campaign','signup_welcome','manual')),
  source_id uuid null,
  payload jsonb not null,  -- subject/html/template_sid/variables
  dedupe_key text generated always as (
    md5(source_kind || ':' || coalesce(source_id::text,'') || ':' || recipient_address)
  ) stored,
  status text not null default 'queued' check (status in ('queued','claimed','sent','failed','dead')),
  claim_token uuid null,
  claimed_at timestamptz null,
  retry_count int not null default 0,
  next_retry_at timestamptz not null default now(),
  send_after timestamptz not null default now(),
  last_error text null,
  sent_at timestamptz null,
  external_id text null,
  cost_estimate_cents int null,
  created_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);
create index on m05_publish_jobs (status, next_retry_at) where status = 'queued';
create index on m05_publish_jobs (claimed_at) where status = 'claimed';
```

#### `m05_publish_log`
```sql
create table m05_publish_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  job_id uuid not null references m05_publish_jobs(id),
  channel text not null,
  provider text not null,
  recipient_contact_id uuid null,
  recipient_address text not null,
  content_snapshot jsonb not null,  -- copia completa payload inviato
  external_id text null,
  cost_actual_cents int null,
  status text not null check (status in ('sent','failed')),
  provider_response jsonb null,
  sent_at timestamptz not null default now()
);
-- Trigger append-only:
create or replace function m05_publish_log_no_update() returns trigger as $$
begin raise exception 'm05_publish_log is append-only (RF-5.7)'; end;
$$ language plpgsql;
create trigger m05_publish_log_no_update_trg
  before update or delete on m05_publish_log
  for each row execute function m05_publish_log_no_update();
```

#### `m05_provider_webhooks`
```sql
create table m05_provider_webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null,  -- null se non deducibile
  provider text not null,
  webhook_type text not null,  -- 'delivery','read','bounce','complaint'
  external_id text null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  processing_error text null
);
create index on m05_provider_webhooks (processed_at) where processed_at is null;
```

**RLS su tutte le tabelle:** service_role only (nessuna policy select per client). Consumer autenticati passano per server actions che usano admin client (RS-2).

**Modifiche a tabelle esistenti:** nessuna.

### I 6 gate di `sendMessage`

Chiamati in ordine. Ogni fallimento è un throw tipizzato, l'invio non è accodato.

1. **Consent (RF-1.4)**: `contact_consents(contact_id, channel).status = 'granted'`. Se il canale è `whatsapp`, richiede anche `contact.phone_e164` presente. Errore: `ConsentMissingError`.
2. **Channel enabled**: `m05_channel_credentials(org, channel).enabled = true` e `verified_at is not null`. Errore: `ChannelDisabledError`.
3. **Quiet hours (RF-5.6)**: se `now()` è dentro il range e canale è WA, NON si scarta: si setta `send_after = quiet_hours_end + 1 min` sul job. Non è un errore, è ritardo.
4. **Pressione commerciale (RA-8.4)**: `COUNT(m05_publish_log WHERE contact_id=X, channel=Y, sent_at >= date_trunc('month', now()), payload->'promotional'::boolean = true)` vs `max_per_month_per_contact`. Errore: `PressureLimitError`. Applica solo se `payload.promotional=true`.
5. **Governance content (RF-6.15..6.20)**: se `payload.contains_offer` o `source_kind = 'voucher'`, chiama `m13-governance.validateOfferAgainstCommercialRules(offer)`. Errore: `CommercialGuardError`. **Nota RS-1:** M05 importa da `m13-governance/public.ts`, non viceversa.
6. **Budget (RF-11.5 esteso)**: `estimateCost(payload) + ledger_mese_canale <= m11 budget.publishing.<channel>`. Errore: `BudgetExceededError`. Se budget non è configurato per il canale, gate skippato (fail-open in dev, da valutare per prod).

### Worker (RS-4)

**Trigger:** pg_cron su Supabase, ogni **1 minuto** (limite Free plan).
Schedule: `select cron.schedule('m05-publisher-tick', '* * * * *', $$select net.http_post(url:='https://<host>/api/publisher/tick', headers:='{"authorization":"Bearer <cron-token>"}'::jsonb)$$);`

**Route:** `app/src/app/api/publisher/tick/route.ts`
- Metodo POST, verifica `authorization: Bearer <cron-token>` (secret in env, non pubblico)
- Chiama `m05-publishing/internal/worker.tickBatch(20)` (cap 20 job per tick)

**Flusso `tickBatch(n)`:**
```
1. RECLAIM ORFANI (job con claimed_at > 5 min fa)
   UPDATE m05_publish_jobs
   SET status='queued', claim_token=null, claimed_at=null
   WHERE status='claimed' AND claimed_at < now() - interval '5 min'

2. CLAIM (transazione con SKIP LOCKED)
   WITH picked AS (
     SELECT id FROM m05_publish_jobs
     WHERE status='queued'
       AND next_retry_at <= now()
       AND send_after <= now()
     ORDER BY created_at
     LIMIT n
     FOR UPDATE SKIP LOCKED
   )
   UPDATE m05_publish_jobs
   SET status='claimed', claim_token=$token, claimed_at=now()
   WHERE id IN (SELECT id FROM picked)
   RETURNING *;

3. Per ogni job claimato:
   3a. adapter = getAdapter(job.channel, job.provider)
   3b. credentials = getCredentials(job.organization_id, job.channel) → decrypt via Vault
   3c. try:
         { externalId, costCents } = await adapter.send(job.payload, credentials)
         INSERT m05_publish_log (job_id, status='sent', external_id, cost_actual_cents, ...)
         UPDATE m05_publish_jobs SET status='sent', sent_at=now(), external_id=... WHERE id=job.id AND claim_token=$token
       catch (err):
         retry_count = job.retry_count + 1
         if retry_count > 5:
           INSERT m05_publish_log (status='failed', provider_response=err, ...)
           UPDATE m05_publish_jobs SET status='dead', last_error=err.message
         else:
           backoff_seconds = [60, 300, 900, 3600, 21600][retry_count - 1]
           UPDATE m05_publish_jobs
           SET status='queued', claim_token=null, claimed_at=null,
               retry_count=retry_count, next_retry_at=now()+backoff, last_error=err.message
```

**Sicurezza `claim_token`:** ogni UPDATE finale include `WHERE claim_token=$token` per evitare che un worker aggiorni un job che nel frattempo è stato rilasciato e ri-picked da un altro tick.

**Backoff exponential:** 1m → 5m → 15m → 1h → 6h → dead. Tot ~7h prima di dichiarare morto un job.

**Notifica dead-letter (RF-5.5 "notifica in caso di fallimento definitivo"):** trigger DB su INSERT `m05_publish_log(status='failed')` → insert in `reminders` (kind='publish_failed') per Owner. In v2 arriva anche una email di notifica.

### UI in `/impostazioni` (M11 admin)

**Nuova capability set:**
- `publishing.credentials.manage` — Owner
- `publishing.send` — Owner + editor (accodare invio singolo)
- `publishing.send_bulk` — Owner (v2, non usata in v1)
- `publishing.retry_dead` — Owner

**Nuovi componenti in `src/components/admin/`:**
- `channel-credentials-card.tsx` — sezione "Canali di invio"
- `channel-test-modal.tsx` — modal test send
- `channel-config-form.tsx` — quiet hours + max/mese + allow_promotional

**Flow tipico Owner:**
1. `/impostazioni` → sezione "Canali di invio"
2. Ognuno dei 2 canali (Email, WhatsApp) ha una card con stato
3. Click "Configura Email" → form con:
   - API key Resend (input type=password + show/hide)
   - From address (readonly, viene da `brand_email_identity`)
   - Reply-to (readonly)
   - Submit → server action `updatePublishCredentials`
4. Server action:
   - Insert/update in `vault.secrets` (via `vault.create_secret`)
   - Update `m05_channel_credentials` con `vault_secret_id`
   - Audit log `publishing.credentials_updated`
5. Click "Test" → modal chiede email/telefono di destinazione → server action `testChannel`
6. Server action chiama `adapter.ping()` + `adapter.send()` con contenuto fisso "Test da Regìa"
7. Se ok, aggiorna `verified_at` e `last_test_at`, mostra 🟢 sulla card
8. Owner attiva switch "Abilitato" → `enabled=true`

**Kill switch specifico:** ogni card ha uno switch. Disabilitare non cancella credenziali, solo blocca gate 2 (`assertPublishEnabled` throw). Utile per pause maintenance senza perdere config.

**Health check dashboard:** `connections-health-card` esistente (in `src/components/admin/`) è estesa: quando un canale è `verified_at is null` o `verified_at > 24h fa e ha errori`, appare un warning arancio sulla dashboard M12.

## Test invariante (RQ-3)

Non negoziabili in v1:

- `tests/invariants/m05-idempotency.test.ts` — stesso `(source_kind, source_id, recipient)` non enqueue due volte
- `tests/invariants/m05-publish-log-append-only.test.ts` — trigger blocca UPDATE + DELETE
- `tests/invariants/m05-tenant-scoping.test.ts` — credentials + jobs + log non leaked cross-org
- `tests/invariants/m05-consent-gate.test.ts` — sendMessage throw se consent missing
- `tests/invariants/m05-quiet-hours.test.ts` — send_after = quiet_end se WA in quiet
- `tests/invariants/m05-retry-backoff.test.ts` — retry_count aumenta, next_retry_at rispetta backoff, dead a >5
- `tests/invariants/m05-skip-locked.test.ts` — due tick concorrenti non doppio-claim lo stesso job

Nuovi test attesi: **7 file / ~30 test**. Totale suite dopo M05 v1: **~60 file / ~245 test**.

## Test end-to-end manuale in dev

1. Su Cloud staging: configura Resend con API key reale (chiave di test Resend, no billing)
2. Configura contact_consents per un contatto test con email verificata
3. Chiama `sendMessage({ source_kind: 'test', channel: 'email', to: 'me@mia-mail', ... })` da server action test in M11
4. Verifica: job appare in `m05_publish_jobs` con status=queued
5. Attendi 1 min → pg_cron scatta → job status=claimed → status=sent
6. Verifica: log entry in `m05_publish_log`, email arriva in casella
7. Ripeti con stesso `(source_kind, source_id, to)` → job duplicato rifiutato dal UNIQUE (idempotenza)
8. Ripeti con canale disabilitato → gate 2 throw ChannelDisabledError

## Decisioni prese in fase di design

- **Postgres SKIP LOCKED invece di BullMQ**: volumi F1 <10k invii/mese non giustificano l'infra Redis. Postgres è già lì, transazionalità con altre tabelle è un bonus.
- **Un provider per canale in v1**: Twilio + Resend. Multi-provider è un'implementazione di `PublishAdapter`, non un refactor.
- **Vault per secrets**: elegante, gestito dal DB, log immutabile su ogni accesso via `vault.decrypted_secrets`.
- **pg_cron per il tick**: gira dove sta il DB, funziona anche se Next.js è spento. Su Free ha limite 1min (accettabile per F1).
- **v1 senza bulk protection RN-62**: bulk arriva quando integriamo M07 campagne, che è naturalmente il punto di sofferenza (segmenti grandi).
- **v1 senza unsubscribe flow**: è un mini-sottosistema che merita spec proprio, non a coda a M05.
- **Kill switch specifico per canale**: assertPublishEnabled(channel), distinto da assertAiEnabled. Owner può spegnere solo WA se il provider ha un problema.
- **Dedupe_key generated column**: leggibile in Table Editor, invariante calcolato dal DB (RS-3).

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| pg_cron non gira su Cloud Free (min 1min) | Accettato per v1. In Pro si scende a 30s se serve. |
| Twilio richiede template approval per WA | Template creati manualmente su Twilio Console, salvati come template_sid in config. In v1 uno solo (test). |
| Costi Resend/Twilio senza monitoraggio | `estimateCost` chiamato in gate 6. Budget in `m11_ai_spend_budgets` esteso per canale. Log actual_cost in `m05_publish_log`. |
| Worker crasha mid-invio | Reclaim orfani su claimed_at > 5min. Ma se provider ha accettato e worker crasha, retry manderebbe 2x. Mitigazione: solo Twilio + Resend forniscono idempotency keys — usali (RF-5.5). |
| Vault non disponibile in un contesto | Vault è pgsodium under the hood: sempre disponibile su Supabase. Test di ping decrypt in health check. |
| Editor abusa di sendMessage | `publishing.send` sì all'editor ma solo 1 destinatario. Bulk richiede `publishing.send_bulk` (Owner). Gate 4 limita spam anche accidentale. |

## Definition of done v1

- Tutte le 5 tabelle create, RLS + trigger append-only attivi
- 2 adapter (Twilio + Resend) implementati con `ping`, `send`, `estimateCost`, `getStatus`
- Vault integration funzionante (create + decrypt via server action)
- 6 gate implementati e testati
- pg_cron schedulato (locale + Cloud), route `/api/publisher/tick` protetta con secret
- UI in `/impostazioni`: card per canale, form credenziali, test modal, switch enabled
- Nuove capabilities in permissions.ts + test permessi aggiornato
- 7 test file invariante verdi
- CI locale + build green
- Docs: help-content.ts aggiornato per la nuova sezione impostazioni
- Manual smoke test: invio test email a se stesso da UI, arriva in casella

## Aperto per v2

- RN-62 bulk protection (preview, digitare numero, invio prova, partenza scaglionata) — richiesto quando integriamo M07 campagne
- RN-64..67 unsubscribe flow con motivo — spec dedicato
- Integrazione M09 reminders → invio automatico via WA (utilità RF-5.5a)
- Integrazione M10 signup → welcome message RN-63
- SMS/FB/IG/Google adapter — nuovi provider, stessa architettura
- Log viewer UI `/pubblicazioni` con filtri e retry manuale
- Template management UI (crea/edit template WA senza Twilio Console)
- Cost estimator UI (RN-82: mostra costo prima dell'invio)
- Notifica email a Owner su dead-letter
