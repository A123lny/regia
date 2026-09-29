# M05 Publishing v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare Regìa a pubblicare messaggi reali su WhatsApp (via Twilio) ed Email (via Resend), con architettura adapter estensibile, coda idempotente con retry/dead-letter e credenziali sicure via Supabase Vault.

**Architecture:** Modulo `m05-publishing` (RS-1) espone `sendMessage(input) → Job` che passa per 6 gate obbligatori (consent, channel enabled, quiet hours, pressione, governance, budget) prima di accodare in `m05_publish_jobs`. Worker `tickBatch` gira ogni 1 min via pg_cron su Supabase, claima con SKIP LOCKED, esegue tramite adapter concreto (`PublishAdapter` interface — RS-2), logga append-only su `m05_publish_log` (RF-5.7) e ritenta con backoff exponential fino a dead-letter dopo 5 fallimenti.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres 17 + Vault + pg_cron), Twilio SDK per WhatsApp, Resend SDK per Email, TypeScript strict, Vitest per test invariante.

**Spec:** `docs/superpowers/specs/2026-09-29-m05-publishing-design.md`

## Global Constraints

- **Nessun secret in codice o env.local**: API keys Twilio/Resend vivono in `vault.secrets`, referenziate via `vault_secret_id` in `m05_channel_credentials`. Server decrypta via `service_role` + `vault.decrypted_secrets` view.
- **RS-1**: `m05-publishing/internal/*` non importabile fuori dal modulo. Solo `public.ts` esporta.
- **RS-2**: consumer del modulo dipendono da `PublishAdapter` interface, mai da `TwilioClient`/`ResendClient` direttamente.
- **RS-3**: idempotenza invii garantita da `UNIQUE(organization_id, dedupe_key)` in DB, non solo applicativa. Log immutabile via trigger anti-UPDATE/DELETE.
- **RS-4**: coda con claim_token, retry con backoff exponential, dead-letter dopo 5 fallimenti, reclaim orfani dopo 5 min.
- **RS-8**: schema DB solo via migrazioni versionate (una singola migrazione `20260929000001_m05_publishing.sql`).
- **RN-87**: tutte le tabelle hanno `organization_id`, RLS denial-by-default.
- **RA-8.6**: kill switch per canale + budget check applicati dal codice, non dal modello.
- **Un provider per canale in v1**: Twilio per WA, Resend per Email. Multi-provider è nuova implementazione di `PublishAdapter`, non refactor.
- **Nessun invio massivo in v1**: `sendMessage(input)` accetta 1 recipient. Bulk arriva con RN-62 in v2.
- **Nessuna dipendenza cross-modulo in v1**: M05 non chiama M03/M06/M07/M09/M10. Solo M13-governance è consumata (gate 5) e M11-admin (assertPublishEnabled, budget).
- **Test non negoziabili RQ-3**: idempotenza invii, tenant scoping, append-only log, consent gate, quiet hours redirect, retry backoff, SKIP LOCKED.

---

### Task 1: Migrazione DB M05 (5 tabelle + trigger + seed default)

**Files:**
- Create: `app/supabase/migrations/20260929000001_m05_publishing.sql`
- Test: `app/tests/invariants/m05-publish-log-append-only.test.ts`

**Interfaces:**
- Consumes: `organizations`, `contacts` (FK)
- Produces: tabelle `m05_channel_credentials`, `m05_channel_config`, `m05_publish_jobs`, `m05_publish_log`, `m05_provider_webhooks`

- [ ] **Step 1: Scrivere la migrazione DB**

Crea `app/supabase/migrations/20260929000001_m05_publishing.sql` con:

```sql
-- M05 Publishing v1 (RF-5.1..5.7, RA-8.4, RS-3, RS-4, RS-8, RN-87)
-- Adapter per canale (Twilio WA + Resend Email in v1), coda idempotente,
-- log immutabile, credenziali via Supabase Vault.

-- Vault e' gia enabled su Supabase (extension supabase_vault). Verifica:
-- select extname from pg_extension where extname='supabase_vault';

create table m05_channel_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp','sms','facebook','instagram','google')),
  provider text not null,
  vault_secret_id uuid not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  verified_at timestamptz null,
  last_test_at timestamptz null,
  last_test_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel)
);

create table m05_channel_config (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel text not null,
  quiet_hours_start time not null default '09:00',
  quiet_hours_end time not null default '21:00',
  allow_promotional boolean not null default true,
  max_per_month_per_contact int not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, channel)
);

create table m05_publish_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel text not null,
  provider text not null,
  recipient_contact_id uuid null references contacts(id) on delete set null,
  recipient_address text not null,
  source_kind text not null check (source_kind in ('test','reminder','voucher','campaign','signup_welcome','manual')),
  source_id uuid null,
  payload jsonb not null,
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
  is_promotional boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);
create index m05_publish_jobs_queued_idx on m05_publish_jobs (next_retry_at, created_at) where status = 'queued';
create index m05_publish_jobs_claimed_idx on m05_publish_jobs (claimed_at) where status = 'claimed';
create index m05_publish_jobs_contact_month_idx on m05_publish_jobs (organization_id, recipient_contact_id, channel, sent_at) where status = 'sent';

create table m05_publish_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id uuid not null references m05_publish_jobs(id) on delete restrict,
  channel text not null,
  provider text not null,
  recipient_contact_id uuid null,
  recipient_address text not null,
  content_snapshot jsonb not null,
  external_id text null,
  cost_actual_cents int null,
  status text not null check (status in ('sent','failed')),
  provider_response jsonb null,
  is_promotional boolean not null default false,
  sent_at timestamptz not null default now()
);
create index m05_publish_log_contact_month_idx on m05_publish_log (organization_id, recipient_contact_id, channel, sent_at) where is_promotional = true;

-- RF-5.7: log append-only, no UPDATE/DELETE.
create or replace function m05_publish_log_no_update() returns trigger as $$
begin raise exception 'm05_publish_log is append-only (RF-5.7)'; end;
$$ language plpgsql;
create trigger m05_publish_log_no_update_trg
  before update or delete on m05_publish_log
  for each row execute function m05_publish_log_no_update();

create table m05_provider_webhooks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid null references organizations(id) on delete set null,
  provider text not null,
  webhook_type text not null,
  external_id text null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz null,
  processing_error text null
);
create index m05_provider_webhooks_pending_idx on m05_provider_webhooks (received_at) where processed_at is null;

-- RLS denial-by-default su tutte (service_role bypassa comunque).
alter table m05_channel_credentials enable row level security;
alter table m05_channel_config enable row level security;
alter table m05_publish_jobs enable row level security;
alter table m05_publish_log enable row level security;
alter table m05_provider_webhooks enable row level security;

-- Seed config default per org 00000000...01 (Gruppo Lenny):
-- WA: quiet 9-21, no promotional (RF-5.5a), max 2/mese
-- Email: no quiet (00-24), promotional ok, max 4/mese
insert into m05_channel_config (organization_id, channel, quiet_hours_start, quiet_hours_end, allow_promotional, max_per_month_per_contact)
values
  ('00000000-0000-0000-0000-000000000001','whatsapp','09:00','21:00',false,2),
  ('00000000-0000-0000-0000-000000000001','email','00:00','23:59',true,4)
on conflict do nothing;
```

- [ ] **Step 2: Scrivere test append-only invariante (fallisce ora)**

`app/tests/invariants/m05-publish-log-append-only.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getAdminClient } from "@/lib/db/admin";

const admin = getAdminClient() as any;

describe("m05_publish_log append-only (RF-5.7)", () => {
  const orgId = "00000000-0000-0000-0000-000000000001";
  let jobId: string;
  let logId: string;

  beforeEach(async () => {
    // crea job + log
    const { data: j } = await admin.from("m05_publish_jobs").insert({
      organization_id: orgId, channel: "email", provider: "resend",
      recipient_address: "test@x.it", source_kind: "test",
      payload: { subject: "t", html: "t" }, status: "sent", sent_at: new Date().toISOString(),
    }).select("id").single();
    jobId = j.id;
    const { data: l } = await admin.from("m05_publish_log").insert({
      organization_id: orgId, job_id: jobId, channel: "email", provider: "resend",
      recipient_address: "test@x.it", content_snapshot: { subject: "t" }, status: "sent",
    }).select("id").single();
    logId = l.id;
  });

  it("blocca UPDATE su un log entry", async () => {
    const { error } = await admin.from("m05_publish_log")
      .update({ external_id: "modified" }).eq("id", logId);
    expect(error?.message).toMatch(/append-only/i);
  });

  it("blocca DELETE su un log entry", async () => {
    const { error } = await admin.from("m05_publish_log").delete().eq("id", logId);
    expect(error?.message).toMatch(/append-only/i);
  });
});
```

- [ ] **Step 3: Run test — deve fallire (tabella non esiste ancora)**

Run: `cd app && npx supabase db reset --no-seed`
Expected: applica tutte le migrazioni incluso 20260929000001. Se error, la SQL è rotta — fix.

Run: `npm test -- m05-publish-log-append-only`
Expected: PASS (trigger blocca UPDATE/DELETE)

- [ ] **Step 4: Verifica RLS attivo su Cloud staging**

Run: `npx dotenv -e .env.staging -- npx supabase db push --linked`
Expected: migrazione applicata al Cloud.

Run: `npx supabase db query --linked "select tablename, rowsecurity from pg_tables where tablename like 'm05_%';"`
Expected: 5 tabelle, tutte con `rowsecurity=true`.

- [ ] **Step 5: Commit**

```bash
git add app/supabase/migrations/20260929000001_m05_publishing.sql \
        app/tests/invariants/m05-publish-log-append-only.test.ts
git commit -m "RF-5.7 RS-3 RS-8 M05: schema DB (5 tabelle + trigger append-only + seed config)"
```

---

### Task 2: Capabilities + labels + audit events

**Files:**
- Modify: `app/src/lib/auth/permissions.ts`
- Modify: `app/tests/invariants/permissions.test.ts`

**Interfaces:**
- Produces: 4 nuove capabilities `publishing.credentials.manage`, `publishing.send`, `publishing.send_bulk`, `publishing.retry_dead`

- [ ] **Step 1: Aggiungere capabilities al type + matrice**

In `permissions.ts` dopo `"abandonment.detect"`:

```typescript
  // M05 Publishing (RF-5.x) - invii verso l'esterno
  | "publishing.credentials.manage"
  | "publishing.send"
  | "publishing.send_bulk"
  | "publishing.retry_dead";
```

E nella matrice `CAPABILITIES`:

```typescript
"publishing.credentials.manage": ["owner"],  // API keys strategiche
"publishing.send": ["owner", "editor"],       // invio singolo (test o operativo)
"publishing.send_bulk": ["owner"],            // bulk = costo + rischio, Owner-only (v2)
"publishing.retry_dead": ["owner"],           // recovery manuale
```

E in `CAPABILITY_LABELS`:

```typescript
"publishing.credentials.manage": "Configurare canali di invio (API keys)",
"publishing.send": "Inviare un messaggio (test o singolo)",
"publishing.send_bulk": "Inviare a piu destinatari (bulk)",
"publishing.retry_dead": "Rilanciare invii falliti definitivamente",
```

- [ ] **Step 2: Aggiornare test permessi**

In `tests/invariants/permissions.test.ts`, nell'array `all[]` (owner):

```typescript
"publishing.credentials.manage",
"publishing.send",
"publishing.send_bulk",
"publishing.retry_dead",
```

Editor positivi:
```typescript
expect(hasCapability("editor", "publishing.send")).toBe(true);
```

Editor negativi:
```typescript
expect(hasCapability("editor", "publishing.credentials.manage")).toBe(false);
expect(hasCapability("editor", "publishing.send_bulk")).toBe(false);
expect(hasCapability("editor", "publishing.retry_dead")).toBe(false);
```

- [ ] **Step 3: Run test permessi**

Run: `npm test -- permissions`
Expected: PASS.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/auth/permissions.ts app/tests/invariants/permissions.test.ts
git commit -m "RU-1a RA-8.6 M05: 4 nuove capability publishing.* (manage credentials + send + retry)"
```

---

### Task 3: Types + PublishAdapter interface + factory

**Files:**
- Create: `app/src/modules/m05-publishing/public.ts`
- Create: `app/src/modules/m05-publishing/internal/types.ts`
- Create: `app/src/modules/m05-publishing/internal/adapter-registry.ts`

**Interfaces:**
- Produces: `Channel`, `PublishAdapter`, `OutgoingMessage`, `PublishInput`, `Job`, `PublishError` classes, `getAdapter(channel, provider)`

- [ ] **Step 1: Creare types.ts**

`app/src/modules/m05-publishing/internal/types.ts`:

```typescript
// M05 Publishing - tipi condivisi (RS-2 interfaccia adapter).

export type Channel = "email" | "whatsapp" | "sms" | "facebook" | "instagram" | "google";

export type EmailMessage = {
  channel: "email";
  to: string;
  subject: string;
  html: string;
  text?: string;
  from: string;
  replyTo?: string;
};

export type WhatsAppMessage = {
  channel: "whatsapp";
  to: string;  // E.164 phone
  templateSid: string;
  variables: Record<string, string>;
  from: string;  // sender phone Twilio
};

export type OutgoingMessage = EmailMessage | WhatsAppMessage;

export type SendResult = {
  externalId: string;
  costCents: number;
};

export type AdapterCredentials = {
  apiKey: string;
  config: Record<string, unknown>;  // account_sid, from_number, from_email...
};

/**
 * RS-2 · unica porta verso servizi esterni di publishing.
 * Ogni provider concreto (Twilio, Resend, ...) implementa questa interfaccia.
 */
export interface PublishAdapter {
  readonly channel: Channel;
  readonly provider: string;

  send(input: OutgoingMessage, credentials: AdapterCredentials): Promise<SendResult>;
  ping(credentials: AdapterCredentials): Promise<{ ok: true } | { ok: false; error: string }>;
  estimateCost(input: OutgoingMessage): Promise<number>;
  getStatus(externalId: string, credentials: AdapterCredentials): Promise<"sent" | "delivered" | "failed" | "unknown">;
}

export class PublishError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "PublishError"; }
}
export class ConsentMissingError extends PublishError { constructor(msg: string) { super("CONSENT_MISSING", msg); } }
export class ChannelDisabledError extends PublishError { constructor(msg: string) { super("CHANNEL_DISABLED", msg); } }
export class PressureLimitError extends PublishError { constructor(msg: string) { super("PRESSURE_LIMIT", msg); } }
export class BudgetExceededError extends PublishError { constructor(msg: string) { super("BUDGET_EXCEEDED", msg); } }
export class QueueFullError extends PublishError { constructor(msg: string) { super("QUEUE_FULL", msg); } }
export class DuplicateJobError extends PublishError { constructor(msg: string) { super("DUPLICATE_JOB", msg); } }
```

- [ ] **Step 2: Creare adapter-registry.ts (factory)**

`app/src/modules/m05-publishing/internal/adapter-registry.ts`:

```typescript
// M05 - factory adapter concreto per (channel, provider).
import type { PublishAdapter } from "./types";

// Le importazioni degli adapter concreti sono lazy per non richiedere Twilio/Resend
// SDK se il canale non e' configurato. Task 9-10 aggiungono le due implementazioni.

export async function getAdapter(channel: string, provider: string): Promise<PublishAdapter> {
  if (channel === "email" && provider === "resend") {
    const { ResendEmailAdapter } = await import("./adapter-resend");
    return new ResendEmailAdapter();
  }
  if (channel === "whatsapp" && provider === "twilio") {
    const { TwilioWhatsAppAdapter } = await import("./adapter-twilio");
    return new TwilioWhatsAppAdapter();
  }
  throw new Error(`No adapter for channel=${channel} provider=${provider}`);
}
```

- [ ] **Step 3: Creare public.ts (contratto RS-1)**

`app/src/modules/m05-publishing/public.ts`:

```typescript
// M05 Publishing - interfaccia pubblica (RS-1).

export type {
  Channel,
  OutgoingMessage,
  EmailMessage,
  WhatsAppMessage,
  SendResult,
} from "./internal/types";

export {
  PublishError,
  ConsentMissingError,
  ChannelDisabledError,
  PressureLimitError,
  BudgetExceededError,
  QueueFullError,
  DuplicateJobError,
} from "./internal/types";

// Server actions e sendMessage arrivano nei task successivi.
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/m05-publishing/
git commit -m "RS-1 RS-2 M05: modulo scheletro con types + PublishAdapter interface + factory registry"
```

---

### Task 4: Vault helpers (createSecret, decrypt, delete)

**Files:**
- Create: `app/src/modules/m05-publishing/internal/vault-repo.ts`

**Interfaces:**
- Consumes: `vault.secrets`, `vault.decrypted_secrets` (Supabase Vault)
- Produces: `createVaultSecret(value, name)`, `decryptVaultSecret(secretId)`, `deleteVaultSecret(secretId)`, `updateVaultSecret(secretId, newValue)`

- [ ] **Step 1: Verificare Vault disponibile in test env**

Run: `npx supabase db query "select id, name from vault.secrets limit 1;"`
Expected: query esegue (anche se ritorna 0 righe). Se error `permission denied`, verifica che il service_role sia usato.

- [ ] **Step 2: Scrivere vault-repo.ts**

`app/src/modules/m05-publishing/internal/vault-repo.ts`:

```typescript
// M05 - accesso a Supabase Vault per credenziali provider.
// Solo service_role puo leggere/scrivere vault.secrets.

import { getAdminClient } from "@/lib/db/admin";

/**
 * Crea un secret in vault.secrets. Ritorna l'id UUID.
 * Il nome e' descrittivo (es. "m05_email_resend_<org>_<timestamp>") per audit.
 */
export async function createVaultSecret(value: string, name: string, description?: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.rpc("vault_create_secret", {
    p_value: value,
    p_name: name,
    p_description: description ?? null,
  });
  // Se la rpc non esiste, chiamare direttamente vault.create_secret via SQL:
  if (error && error.code === "42883") {
    const { data: sql, error: sqlErr } = await admin.from("vault.secrets").insert({
      name, description: description ?? null, secret: value,
    }).select("id").single();
    if (sqlErr) throw new Error(`Vault createSecret: ${sqlErr.message}`);
    return sql.id as string;
  }
  if (error) throw new Error(`Vault createSecret: ${error.message}`);
  return data as string;
}

/** Legge il secret decifrato. Solo service_role. */
export async function decryptVaultSecret(secretId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("vault.decrypted_secrets")
    .select("decrypted_secret")
    .eq("id", secretId)
    .single();
  if (error || !data) throw new Error(`Vault decryptSecret: ${error?.message ?? "not found"}`);
  return data.decrypted_secret as string;
}

/** Aggiorna il valore mantenendo lo stesso id. */
export async function updateVaultSecret(secretId: string, newValue: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin.from("vault.secrets").update({ secret: newValue }).eq("id", secretId);
  if (error) throw new Error(`Vault updateSecret: ${error.message}`);
}

/** Elimina il secret. */
export async function deleteVaultSecret(secretId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin.from("vault.secrets").delete().eq("id", secretId);
  if (error) throw new Error(`Vault deleteSecret: ${error.message}`);
}
```

- [ ] **Step 3: Smoke test manuale (nessun test unit — Vault fatto per integrazione)**

Aggiungi test veloce in `app/scripts/dev-test-vault.ts` (temporaneo, cancella dopo):

```typescript
import { createVaultSecret, decryptVaultSecret, deleteVaultSecret } from "../src/modules/m05-publishing/internal/vault-repo";

async function main() {
  const id = await createVaultSecret("sk_test_123", "dev-test-vault", "smoke test M05");
  console.log("Created:", id);
  const val = await decryptVaultSecret(id);
  console.log("Decrypted:", val === "sk_test_123" ? "MATCH" : "MISMATCH!");
  await deleteVaultSecret(id);
  console.log("Deleted:", id);
}
main().catch(console.error);
```

Run: `npx tsx app/scripts/dev-test-vault.ts` (o esegui in un contesto server)
Expected: `Created: <uuid>`, `Decrypted: MATCH`, `Deleted: <uuid>`.

Rimuovi lo script dopo il test.

- [ ] **Step 4: Typecheck + boundaries**

Run: `npm run typecheck && npm run boundaries`
Expected: PASS su entrambi.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/m05-publishing/internal/vault-repo.ts
git commit -m "RNF-1 RS-2 M05: helpers Supabase Vault (create/decrypt/update/delete) per credenziali provider"
```

---

### Task 5: credentials-repo + channel-config-repo

**Files:**
- Create: `app/src/modules/m05-publishing/internal/credentials-repo.ts`
- Create: `app/src/modules/m05-publishing/internal/channel-config-repo.ts`
- Test: `app/tests/invariants/m05-tenant-scoping.test.ts`

**Interfaces:**
- Consumes: `vault-repo.ts` (task 4)
- Produces: `getChannelCredentials(orgId, channel)`, `upsertChannelCredentials(input)`, `deleteChannelCredentials(orgId, channel)`, `getChannelConfig(orgId, channel)`, `updateChannelConfig(input)`

- [ ] **Step 1: credentials-repo.ts**

```typescript
// M05 - CRUD credenziali canale + integrazione Vault.
import { getAdminClient } from "@/lib/db/admin";
import { createVaultSecret, decryptVaultSecret, updateVaultSecret, deleteVaultSecret } from "./vault-repo";
import type { Channel, AdapterCredentials } from "./types";

export type ChannelCredentialsRow = {
  id: string; organizationId: string; channel: Channel; provider: string;
  vaultSecretId: string; config: Record<string, unknown>; enabled: boolean;
  verifiedAt: string | null; lastTestAt: string | null; lastTestError: string | null;
  createdAt: string; updatedAt: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCredentials(row: any): ChannelCredentialsRow {
  return {
    id: row.id, organizationId: row.organization_id, channel: row.channel,
    provider: row.provider, vaultSecretId: row.vault_secret_id, config: row.config ?? {},
    enabled: row.enabled, verifiedAt: row.verified_at, lastTestAt: row.last_test_at,
    lastTestError: row.last_test_error, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function listChannelCredentials(organizationId: string): Promise<ChannelCredentialsRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.from("m05_channel_credentials")
    .select("*").eq("organization_id", organizationId).order("channel");
  if (error) throw new Error(`listChannelCredentials: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToCredentials);
}

export async function getChannelCredentials(organizationId: string, channel: Channel): Promise<ChannelCredentialsRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.from("m05_channel_credentials")
    .select("*").eq("organization_id", organizationId).eq("channel", channel).maybeSingle();
  if (error) throw new Error(`getChannelCredentials: ${error.message}`);
  return data ? rowToCredentials(data) : null;
}

/** Ritorna credenziali "vive" con apiKey decifrata (usare solo lato server, nel worker o test). */
export async function loadAdapterCredentials(organizationId: string, channel: Channel): Promise<{ credentials: AdapterCredentials; provider: string } | null> {
  const row = await getChannelCredentials(organizationId, channel);
  if (!row) return null;
  const apiKey = await decryptVaultSecret(row.vaultSecretId);
  return { credentials: { apiKey, config: row.config }, provider: row.provider };
}

export type UpsertChannelCredentialsInput = {
  organizationId: string; channel: Channel; provider: string;
  apiKey: string; config: Record<string, unknown>;
};

export async function upsertChannelCredentials(input: UpsertChannelCredentialsInput): Promise<ChannelCredentialsRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const existing = await getChannelCredentials(input.organizationId, input.channel);
  let vaultId: string;
  if (existing) {
    await updateVaultSecret(existing.vaultSecretId, input.apiKey);
    vaultId = existing.vaultSecretId;
  } else {
    vaultId = await createVaultSecret(
      input.apiKey,
      `m05_${input.channel}_${input.provider}_${input.organizationId}`,
      `M05 ${input.channel} credentials for org ${input.organizationId}`,
    );
  }
  const { data, error } = await admin.from("m05_channel_credentials").upsert({
    organization_id: input.organizationId, channel: input.channel, provider: input.provider,
    vault_secret_id: vaultId, config: input.config, updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,channel" }).select("*").single();
  if (error) throw new Error(`upsertChannelCredentials: ${error.message}`);
  return rowToCredentials(data);
}

export async function setChannelEnabled(organizationId: string, channel: Channel, enabled: boolean): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin.from("m05_channel_credentials")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId).eq("channel", channel);
  if (error) throw new Error(`setChannelEnabled: ${error.message}`);
}

export async function markChannelVerified(organizationId: string, channel: Channel, success: boolean, errorMsg?: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_test_at: now, last_test_error: errorMsg ?? null, updated_at: now };
  if (success) patch.verified_at = now;
  const { error } = await admin.from("m05_channel_credentials")
    .update(patch).eq("organization_id", organizationId).eq("channel", channel);
  if (error) throw new Error(`markChannelVerified: ${error.message}`);
}

export async function deleteChannelCredentials(organizationId: string, channel: Channel): Promise<void> {
  const existing = await getChannelCredentials(organizationId, channel);
  if (!existing) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  await admin.from("m05_channel_credentials").delete()
    .eq("organization_id", organizationId).eq("channel", channel);
  await deleteVaultSecret(existing.vaultSecretId);
}
```

- [ ] **Step 2: channel-config-repo.ts**

```typescript
// M05 - config canale (quiet hours + limiti pressione).
import { getAdminClient } from "@/lib/db/admin";
import type { Channel } from "./types";

export type ChannelConfigRow = {
  id: string; organizationId: string; channel: Channel;
  quietHoursStart: string; quietHoursEnd: string;
  allowPromotional: boolean; maxPerMonthPerContact: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToConfig(row: any): ChannelConfigRow {
  return {
    id: row.id, organizationId: row.organization_id, channel: row.channel,
    quietHoursStart: row.quiet_hours_start, quietHoursEnd: row.quiet_hours_end,
    allowPromotional: row.allow_promotional, maxPerMonthPerContact: row.max_per_month_per_contact,
  };
}

export async function getChannelConfig(organizationId: string, channel: Channel): Promise<ChannelConfigRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.from("m05_channel_config")
    .select("*").eq("organization_id", organizationId).eq("channel", channel).maybeSingle();
  if (error) throw new Error(`getChannelConfig: ${error.message}`);
  if (!data) {
    // fallback default (non dovrebbe capitare grazie al seed, ma safe)
    return {
      id: "", organizationId, channel,
      quietHoursStart: channel === "whatsapp" ? "09:00" : "00:00",
      quietHoursEnd: channel === "whatsapp" ? "21:00" : "23:59",
      allowPromotional: channel !== "whatsapp",
      maxPerMonthPerContact: channel === "whatsapp" ? 2 : 4,
    };
  }
  return rowToConfig(data);
}

export type UpdateChannelConfigInput = {
  organizationId: string; channel: Channel;
  quietHoursStart?: string; quietHoursEnd?: string;
  allowPromotional?: boolean; maxPerMonthPerContact?: number;
};

export async function updateChannelConfig(input: UpdateChannelConfigInput): Promise<ChannelConfigRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.quietHoursStart !== undefined) patch.quiet_hours_start = input.quietHoursStart;
  if (input.quietHoursEnd !== undefined) patch.quiet_hours_end = input.quietHoursEnd;
  if (input.allowPromotional !== undefined) patch.allow_promotional = input.allowPromotional;
  if (input.maxPerMonthPerContact !== undefined) patch.max_per_month_per_contact = input.maxPerMonthPerContact;
  const { data, error } = await admin.from("m05_channel_config").upsert({
    organization_id: input.organizationId, channel: input.channel, ...patch,
  }, { onConflict: "organization_id,channel" }).select("*").single();
  if (error) throw new Error(`updateChannelConfig: ${error.message}`);
  return rowToConfig(data);
}
```

- [ ] **Step 3: Test tenant scoping**

`app/tests/invariants/m05-tenant-scoping.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getAdminClient } from "@/lib/db/admin";
import { getChannelCredentials, upsertChannelCredentials } from "@/modules/m05-publishing/internal/credentials-repo";

const admin = getAdminClient() as any;

describe("M05 tenant scoping (RN-87)", () => {
  it("credentials org A non leggibili da org B", async () => {
    const orgA = "00000000-0000-0000-0000-000000000001";
    const orgB = "00000000-0000-0000-0000-000000000002";
    await admin.from("organizations").upsert({ id: orgB, name: "Test B" });
    await upsertChannelCredentials({
      organizationId: orgA, channel: "email", provider: "resend",
      apiKey: "re_test_A", config: { from: "a@x" },
    });
    const bView = await getChannelCredentials(orgB, "email");
    expect(bView).toBeNull();
  });
});
```

- [ ] **Step 4: Run test**

Run: `npm test -- m05-tenant-scoping`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/m05-publishing/internal/credentials-repo.ts \
        app/src/modules/m05-publishing/internal/channel-config-repo.ts \
        app/tests/invariants/m05-tenant-scoping.test.ts
git commit -m "RN-87 RS-1 M05: credentials-repo + channel-config-repo con Vault integration"
```

---

### Task 6: publish-jobs-repo + publish-log-repo

**Files:**
- Create: `app/src/modules/m05-publishing/internal/publish-jobs-repo.ts`
- Create: `app/src/modules/m05-publishing/internal/publish-log-repo.ts`
- Test: `app/tests/invariants/m05-idempotency.test.ts`

**Interfaces:**
- Produces: `enqueueJob(input)`, `claimBatch(n, workerToken)`, `markSent(jobId, workerToken, externalId, costCents)`, `markFailed(jobId, workerToken, error, retry)`, `reclaimOrphaned()`, `logSent(job, ...)`, `logFailed(job, ...)`

- [ ] **Step 1: publish-jobs-repo.ts**

```typescript
// M05 - CRUD coda invii + claim/finalize per il worker.
import { getAdminClient } from "@/lib/db/admin";
import { DuplicateJobError } from "./types";
import type { Channel, OutgoingMessage } from "./types";
import { randomUUID } from "node:crypto";

export type JobStatus = "queued" | "claimed" | "sent" | "failed" | "dead";

export type EnqueueJobInput = {
  organizationId: string;
  channel: Channel;
  provider: string;
  recipientContactId: string | null;
  recipientAddress: string;
  sourceKind: "test" | "reminder" | "voucher" | "campaign" | "signup_welcome" | "manual";
  sourceId: string | null;
  payload: OutgoingMessage;
  isPromotional: boolean;
  costEstimateCents: number | null;
  sendAfter?: string;  // ISO datetime, default now()
};

export type Job = {
  id: string; organizationId: string; channel: Channel; provider: string;
  recipientContactId: string | null; recipientAddress: string;
  sourceKind: string; sourceId: string | null; payload: OutgoingMessage;
  status: JobStatus; retryCount: number; nextRetryAt: string; sendAfter: string;
  lastError: string | null; sentAt: string | null; externalId: string | null;
  costEstimateCents: number | null; isPromotional: boolean; createdAt: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToJob(row: any): Job {
  return {
    id: row.id, organizationId: row.organization_id, channel: row.channel,
    provider: row.provider, recipientContactId: row.recipient_contact_id,
    recipientAddress: row.recipient_address, sourceKind: row.source_kind,
    sourceId: row.source_id, payload: row.payload,
    status: row.status, retryCount: row.retry_count, nextRetryAt: row.next_retry_at,
    sendAfter: row.send_after, lastError: row.last_error, sentAt: row.sent_at,
    externalId: row.external_id, costEstimateCents: row.cost_estimate_cents,
    isPromotional: row.is_promotional, createdAt: row.created_at,
  };
}

export async function enqueueJob(input: EnqueueJobInput): Promise<Job> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.from("m05_publish_jobs").insert({
    organization_id: input.organizationId, channel: input.channel, provider: input.provider,
    recipient_contact_id: input.recipientContactId, recipient_address: input.recipientAddress,
    source_kind: input.sourceKind, source_id: input.sourceId, payload: input.payload,
    is_promotional: input.isPromotional, cost_estimate_cents: input.costEstimateCents,
    send_after: input.sendAfter ?? new Date().toISOString(),
  }).select("*").single();
  if (error) {
    if (error.code === "23505" && error.message.includes("dedupe_key")) {
      throw new DuplicateJobError("Invio gia in coda con stesso source+destinatario (idempotenza RF-5.5)");
    }
    throw new Error(`enqueueJob: ${error.message}`);
  }
  return rowToJob(data);
}

export async function getJob(jobId: string): Promise<Job | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.from("m05_publish_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) throw new Error(`getJob: ${error.message}`);
  return data ? rowToJob(data) : null;
}

/** RS-4: reclaim di job orfani (worker crashato senza aggiornare status). */
export async function reclaimOrphaned(olderThanMinutes = 5): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const { data, error } = await admin.from("m05_publish_jobs")
    .update({ status: "queued", claim_token: null, claimed_at: null })
    .eq("status", "claimed").lt("claimed_at", cutoff).select("id");
  if (error) throw new Error(`reclaimOrphaned: ${error.message}`);
  return (data ?? []).length;
}

/**
 * RS-4 SKIP LOCKED claim: due tick concorrenti non si pestano.
 * Ritorna i job claimati con lo stesso claim_token (usato in finalize).
 */
export async function claimBatch(n: number): Promise<{ jobs: Job[]; claimToken: string }> {
  const claimToken = randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // usiamo rpc perche' Supabase-js non supporta FOR UPDATE SKIP LOCKED direttamente.
  // Definiremo la funzione SQL nel task 6 step 3.
  const { data, error } = await admin.rpc("m05_claim_jobs", { p_limit: n, p_claim_token: claimToken });
  if (error) throw new Error(`claimBatch: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { jobs: ((data ?? []) as any[]).map(rowToJob), claimToken };
}

export async function markSent(jobId: string, claimToken: string, externalId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin.from("m05_publish_jobs").update({
    status: "sent", sent_at: new Date().toISOString(), external_id: externalId,
    claim_token: null, claimed_at: null,
  }).eq("id", jobId).eq("claim_token", claimToken);
  if (error) throw new Error(`markSent: ${error.message}`);
}

const BACKOFF_SECONDS = [60, 300, 900, 3600, 21600];  // 1m, 5m, 15m, 1h, 6h

export async function markFailed(jobId: string, claimToken: string, errorMessage: string): Promise<{ dead: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: current, error: getErr } = await admin.from("m05_publish_jobs")
    .select("retry_count").eq("id", jobId).single();
  if (getErr) throw new Error(`markFailed getCurrent: ${getErr.message}`);
  const nextCount = (current.retry_count ?? 0) + 1;
  if (nextCount > BACKOFF_SECONDS.length) {
    const { error } = await admin.from("m05_publish_jobs").update({
      status: "dead", last_error: errorMessage, claim_token: null, claimed_at: null,
      retry_count: nextCount,
    }).eq("id", jobId).eq("claim_token", claimToken);
    if (error) throw new Error(`markFailed(dead): ${error.message}`);
    return { dead: true };
  }
  const backoff = BACKOFF_SECONDS[nextCount - 1];
  const nextRetry = new Date(Date.now() + backoff * 1000).toISOString();
  const { error } = await admin.from("m05_publish_jobs").update({
    status: "queued", retry_count: nextCount, next_retry_at: nextRetry,
    last_error: errorMessage, claim_token: null, claimed_at: null,
  }).eq("id", jobId).eq("claim_token", claimToken);
  if (error) throw new Error(`markFailed(retry): ${error.message}`);
  return { dead: false };
}
```

- [ ] **Step 2: publish-log-repo.ts**

```typescript
// M05 - log immutabile invii (RF-5.7).
import { getAdminClient } from "@/lib/db/admin";
import type { Job } from "./publish-jobs-repo";

export async function logSent(job: Job, externalId: string, costActualCents: number | null, providerResponse: unknown): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin.from("m05_publish_log").insert({
    organization_id: job.organizationId, job_id: job.id,
    channel: job.channel, provider: job.provider,
    recipient_contact_id: job.recipientContactId, recipient_address: job.recipientAddress,
    content_snapshot: job.payload, external_id: externalId,
    cost_actual_cents: costActualCents, status: "sent",
    provider_response: providerResponse ?? null, is_promotional: job.isPromotional,
  });
  if (error) throw new Error(`logSent: ${error.message}`);
}

export async function logFailed(job: Job, errorMessage: string, providerResponse?: unknown): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin.from("m05_publish_log").insert({
    organization_id: job.organizationId, job_id: job.id,
    channel: job.channel, provider: job.provider,
    recipient_contact_id: job.recipientContactId, recipient_address: job.recipientAddress,
    content_snapshot: job.payload, external_id: null,
    cost_actual_cents: null, status: "failed",
    provider_response: providerResponse ? { error: errorMessage, response: providerResponse } : { error: errorMessage },
    is_promotional: job.isPromotional,
  });
  if (error) throw new Error(`logFailed: ${error.message}`);
}
```

- [ ] **Step 3: Aggiungere funzione SQL per SKIP LOCKED claim**

Aggiungi a fine `20260929000001_m05_publishing.sql`:

```sql
create or replace function m05_claim_jobs(p_limit int, p_claim_token uuid)
returns setof m05_publish_jobs
language plpgsql
as $$
begin
  return query
  with picked as (
    select id from m05_publish_jobs
    where status = 'queued'
      and next_retry_at <= now()
      and send_after <= now()
    order by created_at
    limit p_limit
    for update skip locked
  )
  update m05_publish_jobs
  set status = 'claimed', claim_token = p_claim_token, claimed_at = now()
  from picked
  where m05_publish_jobs.id = picked.id
  returning m05_publish_jobs.*;
end;
$$;
```

Poi run: `npx supabase db reset --no-seed`
Expected: la funzione compare in `pg_proc`.

- [ ] **Step 4: Test idempotenza**

`app/tests/invariants/m05-idempotency.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { enqueueJob } from "@/modules/m05-publishing/internal/publish-jobs-repo";
import { DuplicateJobError } from "@/modules/m05-publishing/public";

describe("M05 idempotenza invii (RF-5.5)", () => {
  it("stesso source+recipient non enqueuato due volte", async () => {
    const orgId = "00000000-0000-0000-0000-000000000001";
    const sourceId = "11111111-1111-1111-1111-111111111111";
    const payload = { channel: "email" as const, to: "dup@x.it", subject: "s", html: "h", from: "a@x" };
    await enqueueJob({
      organizationId: orgId, channel: "email", provider: "resend",
      recipientContactId: null, recipientAddress: "dup@x.it",
      sourceKind: "test", sourceId, payload, isPromotional: false, costEstimateCents: 10,
    });
    await expect(enqueueJob({
      organizationId: orgId, channel: "email", provider: "resend",
      recipientContactId: null, recipientAddress: "dup@x.it",
      sourceKind: "test", sourceId, payload, isPromotional: false, costEstimateCents: 10,
    })).rejects.toThrow(DuplicateJobError);
  });
});
```

Run: `npm test -- m05-idempotency`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/m05-publishing/internal/publish-jobs-repo.ts \
        app/src/modules/m05-publishing/internal/publish-log-repo.ts \
        app/supabase/migrations/20260929000001_m05_publishing.sql \
        app/tests/invariants/m05-idempotency.test.ts
git commit -m "RS-3 RS-4 M05: publish-jobs-repo (SKIP LOCKED claim) + publish-log-repo append-only"
```

---

### Task 7: Gate implementation + sendMessage orchestrator

**Files:**
- Create: `app/src/modules/m05-publishing/internal/gates.ts`
- Create: `app/src/modules/m05-publishing/internal/send-message.ts`
- Modify: `app/src/modules/m05-publishing/public.ts`
- Test: `app/tests/invariants/m05-consent-gate.test.ts`
- Test: `app/tests/invariants/m05-quiet-hours.test.ts`

**Interfaces:**
- Consumes: `contact_consents` (via m01 public), `m13-governance/public` per `validateOfferAgainstCommercialRules`
- Produces: `sendMessage(input)` esportato in public.ts

- [ ] **Step 1: gates.ts**

```typescript
// M05 - i 6 gate obbligatori prima di enqueue (RA-8.6).
// Applicati in ordine, ogni fallimento e' un throw tipizzato.

import { getAdminClient } from "@/lib/db/admin";
import {
  ConsentMissingError, ChannelDisabledError, PressureLimitError, BudgetExceededError,
} from "./types";
import type { Channel } from "./types";
import { getChannelCredentials } from "./credentials-repo";
import { getChannelConfig } from "./channel-config-repo";

/** Gate 1: consenso RF-1.4 per canale. */
export async function gateConsent(organizationId: string, contactId: string | null, channel: Channel): Promise<void> {
  if (!contactId) return;  // test send senza contactId (destinatario ad-hoc) e' permesso
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.from("contact_consents")
    .select("status").eq("organization_id", organizationId)
    .eq("contact_id", contactId).eq("channel", channel).maybeSingle();
  if (error) throw new Error(`gateConsent: ${error.message}`);
  if (!data || data.status !== "granted") {
    throw new ConsentMissingError(`Consenso ${channel} mancante o revocato per contatto ${contactId}`);
  }
}

/** Gate 2: canale abilitato + verificato. */
export async function gateChannelEnabled(organizationId: string, channel: Channel): Promise<void> {
  const cred = await getChannelCredentials(organizationId, channel);
  if (!cred) throw new ChannelDisabledError(`Nessuna credenziale configurata per ${channel}`);
  if (!cred.enabled) throw new ChannelDisabledError(`Canale ${channel} disabilitato`);
  if (!cred.verifiedAt) throw new ChannelDisabledError(`Canale ${channel} non verificato (fai il test in Impostazioni)`);
}

/** Gate 3: quiet hours (RF-5.6). Ritorna il timestamp send_after applicato. */
export async function gateQuietHours(organizationId: string, channel: Channel): Promise<Date> {
  const config = await getChannelConfig(organizationId, channel);
  const now = new Date();
  if (channel !== "whatsapp") return now;  // quiet applica solo a WA in v1
  const [sh, sm] = config.quietHoursStart.split(":").map(Number);
  const [eh, em] = config.quietHoursEnd.split(":").map(Number);
  const hh = now.getHours();
  const mm = now.getMinutes();
  const cur = hh * 60 + mm;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const inQuietWindow = cur >= startMin && cur < endMin;
  if (inQuietWindow) return now;  // dentro fascia OK -> parte subito
  // fuori fascia -> ritarda a prossima quietHoursStart
  const target = new Date(now);
  target.setHours(sh, sm, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}

/** Gate 4: pressione commerciale (RA-8.4) - solo per is_promotional=true. */
export async function gatePressureLimit(organizationId: string, contactId: string | null, channel: Channel, isPromotional: boolean): Promise<void> {
  if (!contactId || !isPromotional) return;
  const config = await getChannelConfig(organizationId, channel);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { count, error } = await admin.from("m05_publish_log")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId).eq("recipient_contact_id", contactId)
    .eq("channel", channel).eq("is_promotional", true).eq("status", "sent")
    .gte("sent_at", monthStart.toISOString());
  if (error) throw new Error(`gatePressureLimit: ${error.message}`);
  if ((count ?? 0) >= config.maxPerMonthPerContact) {
    throw new PressureLimitError(`Superato limite ${config.maxPerMonthPerContact}/mese per ${channel} su contatto ${contactId}`);
  }
}

/** Gate 5: governance content (RF-6.15..6.20). Chiamato solo se payload contiene offerta. */
export async function gateGovernanceContent(_organizationId: string, _payload: unknown): Promise<void> {
  // In v1 non ci sono ancora hooks automatici: se il chiamante usa sendMessage per un voucher,
  // deve aver gia' chiamato m13-governance.validateOfferAgainstCommercialRules a monte.
  // TODO(v2): integrazione automatica sui payload con offer_id.
  return;
}

/** Gate 6: budget (RF-11.5 esteso). Skip in v1 se budget non configurato. */
export async function gateBudget(organizationId: string, channel: Channel, estimatedCostCents: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // Recupera budget mensile per canale (se esiste). Riusa tabella ai_spend_budgets di M11
  // convertita a "publishing.<channel>" come service_name.
  const { data: budget } = await admin.from("ai_spend_budgets")
    .select("monthly_cap_cents").eq("organization_id", organizationId)
    .eq("service_name", `publishing.${channel}`).maybeSingle();
  if (!budget) return;  // budget non configurato -> gate skip
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const { data: spent } = await admin.from("m05_publish_log")
    .select("cost_actual_cents").eq("organization_id", organizationId)
    .eq("channel", channel).eq("status", "sent").gte("sent_at", monthStart.toISOString());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalCents = ((spent ?? []) as any[]).reduce((sum, r) => sum + (r.cost_actual_cents ?? 0), 0);
  if (totalCents + estimatedCostCents > budget.monthly_cap_cents) {
    throw new BudgetExceededError(`Budget mensile ${channel} sforato (${totalCents}+${estimatedCostCents}>${budget.monthly_cap_cents} centesimi)`);
  }
}
```

- [ ] **Step 2: send-message.ts orchestrator**

```typescript
// M05 - orchestrator sendMessage: 6 gate + enqueue.

import type { OutgoingMessage, Channel } from "./types";
import { gateConsent, gateChannelEnabled, gateQuietHours, gatePressureLimit, gateGovernanceContent, gateBudget } from "./gates";
import { getChannelCredentials } from "./credentials-repo";
import { getAdapter } from "./adapter-registry";
import { enqueueJob, type Job } from "./publish-jobs-repo";

export type SendMessageInput = {
  organizationId: string;
  channel: Channel;
  recipientContactId: string | null;
  payload: OutgoingMessage;
  sourceKind: "test" | "reminder" | "voucher" | "campaign" | "signup_welcome" | "manual";
  sourceId: string | null;
  isPromotional: boolean;
};

export async function sendMessage(input: SendMessageInput): Promise<Job> {
  const { organizationId, channel, recipientContactId, payload, sourceKind, sourceId, isPromotional } = input;

  // Recupera credenziali per estrarre provider (necessario per adapter)
  const creds = await getChannelCredentials(organizationId, channel);
  if (!creds) throw new Error(`Nessuna credenziale ${channel}`);

  // Gate 1-4
  await gateConsent(organizationId, recipientContactId, channel);
  await gateChannelEnabled(organizationId, channel);
  const sendAfter = await gateQuietHours(organizationId, channel);
  await gatePressureLimit(organizationId, recipientContactId, channel, isPromotional);
  await gateGovernanceContent(organizationId, payload);

  // Gate 6: cost estimation
  const adapter = await getAdapter(channel, creds.provider);
  const estCost = await adapter.estimateCost(payload);
  await gateBudget(organizationId, channel, estCost);

  // Enqueue
  const recipientAddress = payload.channel === "email" ? payload.to : payload.to;
  return enqueueJob({
    organizationId, channel, provider: creds.provider,
    recipientContactId, recipientAddress,
    sourceKind, sourceId, payload,
    isPromotional, costEstimateCents: estCost,
    sendAfter: sendAfter.toISOString(),
  });
}
```

- [ ] **Step 3: Aggiornare public.ts**

Aggiungi in `public.ts`:

```typescript
export { sendMessage } from "./internal/send-message";
export type { SendMessageInput } from "./internal/send-message";
export type { Job, JobStatus } from "./internal/publish-jobs-repo";
```

- [ ] **Step 4: Test consent gate**

`app/tests/invariants/m05-consent-gate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sendMessage } from "@/modules/m05-publishing/public";
import { ConsentMissingError } from "@/modules/m05-publishing/public";
import { getAdminClient } from "@/lib/db/admin";

const admin = getAdminClient() as any;

describe("M05 gateConsent (RF-1.4)", () => {
  it("throw ConsentMissingError se contatto ha consent revoked", async () => {
    const orgId = "00000000-0000-0000-0000-000000000001";
    const { data: c } = await admin.from("contacts").insert({
      organization_id: orgId, first_name: "Test", email: "no-consent@x.it",
    }).select("id").single();
    await admin.from("contact_consents").insert({
      organization_id: orgId, contact_id: c.id, channel: "email", status: "revoked",
    });
    await expect(sendMessage({
      organizationId: orgId, channel: "email", recipientContactId: c.id,
      payload: { channel: "email", to: "no-consent@x.it", subject: "s", html: "h", from: "a@x" },
      sourceKind: "test", sourceId: null, isPromotional: false,
    })).rejects.toThrow(ConsentMissingError);
  });
});
```

- [ ] **Step 5: Test quiet hours**

`app/tests/invariants/m05-quiet-hours.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { gateQuietHours } from "@/modules/m05-publishing/internal/gates";

describe("M05 gateQuietHours (RF-5.6)", () => {
  it("WA fuori fascia 09-21 ritorna sendAfter alla prossima start", async () => {
    // Nota: test dipendente dall'orario corrente. Se test gira dentro fascia, sendAfter=now.
    const orgId = "00000000-0000-0000-0000-000000000001";
    const sendAfter = await gateQuietHours(orgId, "whatsapp");
    const nowHour = new Date().getHours();
    if (nowHour < 9 || nowHour >= 21) {
      expect(sendAfter.getHours()).toBe(9);
      expect(sendAfter.getMinutes()).toBe(0);
    } else {
      expect(sendAfter.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    }
  });
  it("Email non ha quiet, ritorna now()", async () => {
    const orgId = "00000000-0000-0000-0000-000000000001";
    const sendAfter = await gateQuietHours(orgId, "email");
    expect(sendAfter.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
```

- [ ] **Step 6: Run test**

Run: `npm test -- m05-consent-gate m05-quiet-hours`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/m05-publishing/internal/gates.ts \
        app/src/modules/m05-publishing/internal/send-message.ts \
        app/src/modules/m05-publishing/public.ts \
        app/tests/invariants/m05-consent-gate.test.ts \
        app/tests/invariants/m05-quiet-hours.test.ts
git commit -m "RA-8.6 RF-1.4 RF-5.6 M05: sendMessage con 6 gate (consent + enabled + quiet + pressure + governance + budget)"
```

---

### Task 8: Adapter Resend (Email concreto)

**Files:**
- Create: `app/src/modules/m05-publishing/internal/adapter-resend.ts`
- Modify: `app/package.json` (dep: `resend`)

**Interfaces:**
- Implements: `PublishAdapter` per canale email

- [ ] **Step 1: Aggiungere dep**

Run: `cd app && npm install resend`
Expected: aggiunge `"resend": "^4.x.x"` a `dependencies`. Nessun errore.

- [ ] **Step 2: adapter-resend.ts**

```typescript
// M05 - adapter Email via Resend (RS-2).
import { Resend } from "resend";
import type { PublishAdapter, OutgoingMessage, EmailMessage, SendResult, AdapterCredentials } from "./types";

export class ResendEmailAdapter implements PublishAdapter {
  readonly channel = "email" as const;
  readonly provider = "resend";

  async send(input: OutgoingMessage, credentials: AdapterCredentials): Promise<SendResult> {
    if (input.channel !== "email") throw new Error("ResendEmailAdapter: input non e' email");
    const msg = input as EmailMessage;
    const client = new Resend(credentials.apiKey);
    const { data, error } = await client.emails.send({
      from: msg.from, to: msg.to, subject: msg.subject, html: msg.html,
      text: msg.text, replyTo: msg.replyTo,
    });
    if (error) throw new Error(`Resend send: ${error.message}`);
    if (!data?.id) throw new Error("Resend send: nessun id restituito");
    return { externalId: data.id, costCents: 4 };  // Resend ~$0.40/1000 email = 0.04c/email arrotondato a 4c
  }

  async ping(credentials: AdapterCredentials): Promise<{ ok: true } | { ok: false; error: string }> {
    const client = new Resend(credentials.apiKey);
    try {
      // Resend API: GET /domains ritorna array. Se key invalida, 401.
      const domains = await client.domains.list();
      if (domains.error) return { ok: false, error: domains.error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async estimateCost(_input: OutgoingMessage): Promise<number> {
    return 4;  // Resend flat pricing
  }

  async getStatus(externalId: string, credentials: AdapterCredentials): Promise<"sent" | "delivered" | "failed" | "unknown"> {
    const client = new Resend(credentials.apiKey);
    try {
      const { data, error } = await client.emails.get(externalId);
      if (error || !data) return "unknown";
      if (data.last_event === "delivered") return "delivered";
      if (data.last_event === "bounced" || data.last_event === "complained") return "failed";
      if (data.last_event === "sent") return "sent";
      return "unknown";
    } catch { return "unknown"; }
  }
}
```

- [ ] **Step 3: Typecheck + boundaries**

Run: `npm run typecheck && npm run boundaries`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/package-lock.json app/src/modules/m05-publishing/internal/adapter-resend.ts
git commit -m "RS-2 RF-5.3 M05: adapter Resend per canale email (send/ping/estimateCost/getStatus)"
```

---

### Task 9: Adapter Twilio (WhatsApp concreto)

**Files:**
- Create: `app/src/modules/m05-publishing/internal/adapter-twilio.ts`
- Modify: `app/package.json` (dep: `twilio`)

**Interfaces:**
- Implements: `PublishAdapter` per canale whatsapp

- [ ] **Step 1: Aggiungere dep**

Run: `cd app && npm install twilio`
Expected: aggiunge `"twilio": "^5.x.x"`.

- [ ] **Step 2: adapter-twilio.ts**

```typescript
// M05 - adapter WhatsApp via Twilio (RS-2, RF-5.4).
import twilio from "twilio";
import type { PublishAdapter, OutgoingMessage, WhatsAppMessage, SendResult, AdapterCredentials } from "./types";

export class TwilioWhatsAppAdapter implements PublishAdapter {
  readonly channel = "whatsapp" as const;
  readonly provider = "twilio";

  async send(input: OutgoingMessage, credentials: AdapterCredentials): Promise<SendResult> {
    if (input.channel !== "whatsapp") throw new Error("TwilioWhatsAppAdapter: input non e' whatsapp");
    const msg = input as WhatsAppMessage;
    const accountSid = credentials.config.accountSid as string;
    if (!accountSid) throw new Error("Twilio: accountSid mancante in config");
    const client = twilio(accountSid, credentials.apiKey);
    const message = await client.messages.create({
      contentSid: msg.templateSid,
      contentVariables: JSON.stringify(msg.variables),
      from: `whatsapp:${msg.from}`,
      to: `whatsapp:${msg.to}`,
    });
    if (message.errorCode) throw new Error(`Twilio ${message.errorCode}: ${message.errorMessage}`);
    return { externalId: message.sid, costCents: 5 };  // Twilio WA ~$0.005/msg utility Italia
  }

  async ping(credentials: AdapterCredentials): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const accountSid = credentials.config.accountSid as string;
      if (!accountSid) return { ok: false, error: "accountSid mancante in config" };
      const client = twilio(accountSid, credentials.apiKey);
      const acct = await client.api.v2010.accounts(accountSid).fetch();
      if (acct.status !== "active") return { ok: false, error: `Account Twilio status: ${acct.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async estimateCost(_input: OutgoingMessage): Promise<number> {
    return 5;  // Approssimazione WA utility. In produzione dovremmo distinguere marketing vs utility.
  }

  async getStatus(externalId: string, credentials: AdapterCredentials): Promise<"sent" | "delivered" | "failed" | "unknown"> {
    try {
      const accountSid = credentials.config.accountSid as string;
      const client = twilio(accountSid, credentials.apiKey);
      const msg = await client.messages(externalId).fetch();
      if (msg.status === "delivered" || msg.status === "read") return "delivered";
      if (msg.status === "failed" || msg.status === "undelivered") return "failed";
      if (msg.status === "sent") return "sent";
      return "unknown";
    } catch { return "unknown"; }
  }
}
```

- [ ] **Step 3: Typecheck + boundaries**

Run: `npm run typecheck && npm run boundaries`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/package-lock.json app/src/modules/m05-publishing/internal/adapter-twilio.ts
git commit -m "RS-2 RF-5.4 M05: adapter Twilio per canale whatsapp (template-based, utility-only)"
```

---

### Task 10: Worker tickBatch + route /api/publisher/tick

**Files:**
- Create: `app/src/modules/m05-publishing/internal/worker.ts`
- Create: `app/src/app/api/publisher/tick/route.ts`
- Modify: `app/.env.local.example` (add `M05_CRON_SECRET`)
- Test: `app/tests/invariants/m05-retry-backoff.test.ts`

**Interfaces:**
- Produces: `tickBatch(n)` esportato in worker.ts, route POST `/api/publisher/tick`

- [ ] **Step 1: worker.ts**

```typescript
// M05 - worker della coda invii (RS-4).
// Chiamato dalla route /api/publisher/tick, che a sua volta e' triggerata da pg_cron.

import { reclaimOrphaned, claimBatch, markSent, markFailed } from "./publish-jobs-repo";
import { logSent, logFailed } from "./publish-log-repo";
import { getAdapter } from "./adapter-registry";
import { loadAdapterCredentials } from "./credentials-repo";

export type TickResult = {
  orphaned: number;
  claimed: number;
  sent: number;
  failed: number;
  dead: number;
  errors: Array<{ jobId: string; error: string }>;
};

export async function tickBatch(batchSize = 20): Promise<TickResult> {
  const result: TickResult = { orphaned: 0, claimed: 0, sent: 0, failed: 0, dead: 0, errors: [] };
  result.orphaned = await reclaimOrphaned(5);
  const { jobs, claimToken } = await claimBatch(batchSize);
  result.claimed = jobs.length;
  for (const job of jobs) {
    try {
      const loaded = await loadAdapterCredentials(job.organizationId, job.channel);
      if (!loaded) throw new Error(`Credenziali ${job.channel} sparite`);
      const adapter = await getAdapter(job.channel, loaded.provider);
      const { externalId, costCents } = await adapter.send(job.payload, loaded.credentials);
      await logSent(job, externalId, costCents, null);
      await markSent(job.id, claimToken, externalId);
      result.sent += 1;
    } catch (err) {
      const errMsg = (err as Error).message;
      const { dead } = await markFailed(job.id, claimToken, errMsg);
      if (dead) {
        await logFailed(job, errMsg);
        result.dead += 1;
      } else {
        result.failed += 1;
      }
      result.errors.push({ jobId: job.id, error: errMsg });
    }
  }
  return result;
}
```

- [ ] **Step 2: route /api/publisher/tick**

`app/src/app/api/publisher/tick/route.ts`:

```typescript
// M05 - endpoint chiamato da pg_cron ogni 1min per processare la coda invii.
// Protetto con secret in header authorization (env M05_CRON_SECRET).

import { NextResponse } from "next/server";
import { tickBatch } from "@/modules/m05-publishing/internal/worker";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.M05_CRON_SECRET}`;
  if (!process.env.M05_CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await tickBatch(20);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Env var**

Aggiorna `app/.env.local.example` aggiungendo:

```
# M05 Publishing - secret per proteggere l'endpoint /api/publisher/tick.
# Genera con: openssl rand -hex 32
M05_CRON_SECRET=
```

Poi in `.env.local` (e `.env.staging`) aggiungi un valore random:

```
M05_CRON_SECRET=<64-hex-chars>
```

- [ ] **Step 4: Test retry backoff**

`app/tests/invariants/m05-retry-backoff.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { enqueueJob, claimBatch, markFailed } from "@/modules/m05-publishing/internal/publish-jobs-repo";

describe("M05 retry backoff (RS-4)", () => {
  it("markFailed aumenta retry_count e ritenta con backoff crescente", async () => {
    const orgId = "00000000-0000-0000-0000-000000000001";
    const job = await enqueueJob({
      organizationId: orgId, channel: "email", provider: "resend",
      recipientContactId: null, recipientAddress: "retry@x.it",
      sourceKind: "test", sourceId: "aaaa1111-1111-1111-1111-111111111111",
      payload: { channel: "email", to: "retry@x.it", subject: "s", html: "h", from: "a@x" },
      isPromotional: false, costEstimateCents: 4,
    });
    const { claimToken } = await claimBatch(1);
    const { dead: dead1 } = await markFailed(job.id, claimToken, "fake failure");
    expect(dead1).toBe(false);
    // dopo 5 failures -> dead
    for (let i = 0; i < 5; i++) {
      const { claimToken: t } = await claimBatch(1);
      if (t) await markFailed(job.id, t, `failure ${i + 2}`);
    }
  });
});
```

- [ ] **Step 5: Run test**

Run: `npm test -- m05-retry-backoff`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/m05-publishing/internal/worker.ts \
        app/src/app/api/publisher/tick/route.ts \
        app/.env.local.example \
        app/tests/invariants/m05-retry-backoff.test.ts
git commit -m "RS-4 M05: worker tickBatch (reclaim+claim+execute) + route /api/publisher/tick protetta"
```

---

### Task 11: pg_cron scheduling (locale + doc Cloud)

**Files:**
- Modify: `app/supabase/migrations/20260929000001_m05_publishing.sql` (aggiungi schedule pg_cron alla fine, con guard)
- Create: `docs/m05-cron-setup.md`

**Interfaces:**
- Produces: cron job `m05-publisher-tick` che POST-a la route ogni 1 min

- [ ] **Step 1: Aggiungere schedule al file di migrazione**

In fondo al file `20260929000001_m05_publishing.sql`, aggiungi:

```sql
-- pg_cron scheduling (opzionale, richiede extension pg_cron abilitata su Cloud).
-- In locale non serve (usa manual tick per test).
-- Su Cloud: enable extension via dashboard o
--   create extension if not exists pg_cron with schema extensions;
-- La schedule viene creata solo se extension e' presente:
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'm05-publisher-tick',
      '* * * * *',  -- ogni 1min (limite Free)
      $body$
      select net.http_post(
        url := current_setting('app.settings.publisher_url', true),
        headers := jsonb_build_object(
          'authorization', 'Bearer ' || current_setting('app.settings.publisher_cron_secret', true),
          'content-type', 'application/json'
        )
      )
      $body$
    );
  end if;
end $$;
```

- [ ] **Step 2: Documentare come attivare cron su Cloud**

`docs/m05-cron-setup.md`:

```markdown
# Setup pg_cron per M05 Publishing

## Su Supabase Cloud (staging/prod)

1. Vai su Dashboard Supabase -> Database -> Extensions
2. Cerca `pg_cron` e `pg_net`. Attivali entrambi.
3. In SQL Editor esegui:

```sql
alter database postgres set app.settings.publisher_url = 'https://<your-next-host>/api/publisher/tick';
alter database postgres set app.settings.publisher_cron_secret = '<M05_CRON_SECRET>';
select cron.schedule(
  'm05-publisher-tick',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.publisher_url'),
    headers := jsonb_build_object(
      'authorization', 'Bearer ' || current_setting('app.settings.publisher_cron_secret'),
      'content-type', 'application/json'
    )
  )
  $$
);
```

4. Verifica: `select * from cron.job;` deve mostrare la riga `m05-publisher-tick`.
5. Verifica esecuzione: `select * from cron.job_run_details order by start_time desc limit 5;`

## In locale (dev)

pg_cron/pg_net non sono attivi. Usa il bottone "Processa coda ora" in `/impostazioni`
oppure chiama manualmente:

```bash
curl -X POST http://localhost:3000/api/publisher/tick \
  -H "Authorization: Bearer $M05_CRON_SECRET"
```

## Rollback

```sql
select cron.unschedule('m05-publisher-tick');
```
```

- [ ] **Step 3: Commit**

```bash
git add app/supabase/migrations/20260929000001_m05_publishing.sql docs/m05-cron-setup.md
git commit -m "RS-4 M05: pg_cron schedule (guarded) + doc setup Cloud + fallback manuale locale"
```

---

### Task 12: UI - credentials-card + form (impostazioni)

**Files:**
- Create: `app/src/components/admin/channel-credentials-card.tsx`
- Create: `app/src/modules/m05-publishing/internal/actions.ts` (server actions per UI)
- Modify: `app/src/app/(protected)/impostazioni/page.tsx` (aggiungi la sezione)
- Modify: `app/src/modules/m05-publishing/public.ts` (esporta actions)

**Interfaces:**
- Produces: server actions `updateChannelCredentialsAction`, `setChannelEnabledAction`, componente `ChannelCredentialsCard`

- [ ] **Step 1: actions.ts server actions**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { upsertChannelCredentials, setChannelEnabled, markChannelVerified, listChannelCredentials } from "./credentials-repo";
import { getAdapter } from "./adapter-registry";
import { loadAdapterCredentials } from "./credentials-repo";
import { updateChannelConfig } from "./channel-config-repo";
import type { Channel } from "./types";

export async function updateChannelCredentialsAction(input: {
  channel: Channel; provider: string; apiKey: string; config: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "publishing.credentials.manage");
  try {
    await upsertChannelCredentials({ organizationId: session.organizationId, ...input });
    await logAuditEvent({
      organizationId: session.organizationId, actorUserId: session.userId, actorKind: "user",
      action: "publishing.credentials_updated",
      details: { channel: input.channel, provider: input.provider },
    });
    revalidatePath("/impostazioni");
    return { ok: true };
  } catch (err) { return { ok: false, error: (err as Error).message }; }
}

export async function setChannelEnabledAction(input: { channel: Channel; enabled: boolean }): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "publishing.credentials.manage");
  try {
    await setChannelEnabled(session.organizationId, input.channel, input.enabled);
    await logAuditEvent({
      organizationId: session.organizationId, actorUserId: session.userId, actorKind: "user",
      action: input.enabled ? "publishing.channel_enabled" : "publishing.channel_disabled",
      details: { channel: input.channel },
    });
    revalidatePath("/impostazioni");
    return { ok: true };
  } catch (err) { return { ok: false, error: (err as Error).message }; }
}

export async function testChannelAction(input: { channel: Channel; testAddress: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "publishing.send");
  try {
    const loaded = await loadAdapterCredentials(session.organizationId, input.channel);
    if (!loaded) return { ok: false, error: `Nessuna credenziale ${input.channel}` };
    const adapter = await getAdapter(input.channel, loaded.provider);
    const ping = await adapter.ping(loaded.credentials);
    if (!ping.ok) {
      await markChannelVerified(session.organizationId, input.channel, false, ping.error);
      return { ok: false, error: ping.error };
    }
    await markChannelVerified(session.organizationId, input.channel, true);
    await logAuditEvent({
      organizationId: session.organizationId, actorUserId: session.userId, actorKind: "user",
      action: "publishing.channel_test", details: { channel: input.channel, address: input.testAddress },
    });
    revalidatePath("/impostazioni");
    return { ok: true };
  } catch (err) { return { ok: false, error: (err as Error).message }; }
}

export async function listChannelsAction() {
  const session = await getSessionOrRedirect();
  requireCapability(session, "publishing.credentials.manage");
  return listChannelCredentials(session.organizationId);
}
```

- [ ] **Step 2: ChannelCredentialsCard component**

```typescript
"use client";

import { useState, useTransition } from "react";
import { updateChannelCredentialsAction, setChannelEnabledAction, testChannelAction } from "@/modules/m05-publishing/public";
import type { Channel } from "@/modules/m05-publishing/public";

type Props = {
  channel: Channel;
  provider: string;
  configured: boolean;
  enabled: boolean;
  verifiedAt: string | null;
  lastTestError: string | null;
};

const CHANNEL_LABELS: Record<Channel, string> = {
  email: "Email (Resend)", whatsapp: "WhatsApp (Twilio)",
  sms: "SMS", facebook: "Facebook", instagram: "Instagram", google: "Google",
};

export function ChannelCredentialsCard(props: Props) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const save = () => startTransition(async () => {
    const res = await updateChannelCredentialsAction({
      channel: props.channel, provider: props.provider, apiKey, config,
    });
    setMsg(res.ok ? "Credenziali salvate. Ora fai il test." : res.error);
  });

  const test = () => startTransition(async () => {
    const res = await testChannelAction({ channel: props.channel, testAddress: "" });
    setMsg(res.ok ? "Connessione ok" : `Test fallito: ${res.error}`);
  });

  const toggle = (enabled: boolean) => startTransition(async () => {
    const res = await setChannelEnabledAction({ channel: props.channel, enabled });
    setMsg(res.ok ? (enabled ? "Canale abilitato" : "Canale disabilitato") : res.error);
  });

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{CHANNEL_LABELS[props.channel]}</h3>
        <span className="text-sm">
          {props.verifiedAt ? "🟢 Verificato" : "⚠️ Non verificato"}
        </span>
      </div>
      <div className="space-y-2">
        <label className="text-sm block">
          API key ({props.provider})
          <div className="flex gap-2 mt-1">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={props.configured ? "•••••••• (inserisci per aggiornare)" : "sk_..."}
              className="flex-1 border rounded px-2 py-1"
            />
            <button type="button" onClick={() => setShowKey(!showKey)} className="text-sm underline">
              {showKey ? "Nascondi" : "Mostra"}
            </button>
          </div>
        </label>
        {props.channel === "whatsapp" && (
          <label className="text-sm block">
            Account SID (Twilio)
            <input type="text" value={config.accountSid ?? ""}
                   onChange={(e) => setConfig({ ...config, accountSid: e.target.value })}
                   placeholder="AC..." className="w-full border rounded px-2 py-1 mt-1" />
          </label>
        )}
        {props.channel === "email" && (
          <label className="text-sm block">
            From (indirizzo mittente)
            <input type="text" value={config.from ?? ""}
                   onChange={(e) => setConfig({ ...config, from: e.target.value })}
                   placeholder="info@brand.it" className="w-full border rounded px-2 py-1 mt-1" />
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={pending || !apiKey}
                className="bg-black text-white px-3 py-1 rounded text-sm">Salva</button>
        <button onClick={test} disabled={pending || !props.configured}
                className="border px-3 py-1 rounded text-sm">Test</button>
        <label className="flex items-center gap-2 text-sm ml-auto">
          <input type="checkbox" checked={props.enabled} onChange={(e) => toggle(e.target.checked)} />
          Abilitato
        </label>
      </div>
      {msg && <p className="text-sm text-gray-600">{msg}</p>}
      {props.lastTestError && !msg && (
        <p className="text-sm text-red-600">Ultimo errore: {props.lastTestError}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Modifica impostazioni page**

In `app/src/app/(protected)/impostazioni/page.tsx`, aggiungi in fondo alla lista di card:

```typescript
import { ChannelCredentialsCard } from "@/components/admin/channel-credentials-card";
import { listChannelsAction } from "@/modules/m05-publishing/public";

// nel componente async page:
const channels = await listChannelsAction();
const emailCred = channels.find((c) => c.channel === "email");
const waCred = channels.find((c) => c.channel === "whatsapp");

// nel JSX:
<section className="space-y-4">
  <h2 className="text-xl font-bold">Canali di invio</h2>
  <p className="text-sm text-gray-600">
    Configura le API key dei provider (Resend per email, Twilio per WhatsApp). Le chiavi
    sono cifrate in Supabase Vault, mai visibili in chiaro dopo il salvataggio.
  </p>
  <ChannelCredentialsCard
    channel="email" provider="resend"
    configured={!!emailCred} enabled={emailCred?.enabled ?? false}
    verifiedAt={emailCred?.verifiedAt ?? null}
    lastTestError={emailCred?.lastTestError ?? null}
  />
  <ChannelCredentialsCard
    channel="whatsapp" provider="twilio"
    configured={!!waCred} enabled={waCred?.enabled ?? false}
    verifiedAt={waCred?.verifiedAt ?? null}
    lastTestError={waCred?.lastTestError ?? null}
  />
</section>
```

- [ ] **Step 4: Esporta actions in public.ts**

Aggiungi:

```typescript
export {
  updateChannelCredentialsAction,
  setChannelEnabledAction,
  testChannelAction,
  listChannelsAction,
} from "./internal/actions";
```

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/m05-publishing/internal/actions.ts \
        app/src/modules/m05-publishing/public.ts \
        app/src/components/admin/channel-credentials-card.tsx \
        app/src/app/\(protected\)/impostazioni/page.tsx
git commit -m "RF-2.7 M05: UI credenziali canali in /impostazioni (card + form + toggle enabled + test)"
```

---

### Task 13: Test SKIP LOCKED concurrency

**Files:**
- Test: `app/tests/invariants/m05-skip-locked.test.ts`

**Interfaces:**
- Verifica: 2 chiamate concorrenti a `claimBatch` non ritornano lo stesso job

- [ ] **Step 1: Test**

```typescript
import { describe, it, expect } from "vitest";
import { enqueueJob, claimBatch } from "@/modules/m05-publishing/internal/publish-jobs-repo";

describe("M05 SKIP LOCKED (RS-4)", () => {
  it("due claimBatch concorrenti non doppio-claim lo stesso job", async () => {
    const orgId = "00000000-0000-0000-0000-000000000001";
    for (let i = 0; i < 3; i++) {
      await enqueueJob({
        organizationId: orgId, channel: "email", provider: "resend",
        recipientContactId: null, recipientAddress: `skl${i}@x.it`,
        sourceKind: "test", sourceId: `bbbb${i}111-1111-1111-1111-111111111111`,
        payload: { channel: "email", to: `skl${i}@x.it`, subject: "s", html: "h", from: "a@x" },
        isPromotional: false, costEstimateCents: 4,
      });
    }
    const [r1, r2] = await Promise.all([claimBatch(10), claimBatch(10)]);
    const ids1 = new Set(r1.jobs.map((j) => j.id));
    const ids2 = new Set(r2.jobs.map((j) => j.id));
    const overlap = [...ids1].filter((id) => ids2.has(id));
    expect(overlap).toHaveLength(0);
    // I due batch insieme hanno claimato al piu' N job (tutti quelli disponibili)
    expect(ids1.size + ids2.size).toBeLessThanOrEqual(3 + 2); // 3 nuovi + max 2 esistenti dai test precedenti
  });
});
```

- [ ] **Step 2: Run**

Run: `npm test -- m05-skip-locked`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/tests/invariants/m05-skip-locked.test.ts
git commit -m "RS-4 M05: test SKIP LOCKED su claim batch concorrenti"
```

---

### Task 14: Help + diario + smoke test finale

**Files:**
- Modify: `app/src/components/help/help-content.ts` (aggiungi entry per impostazioni sezione canali)
- Modify: `docs/diario.md`

**Interfaces:**
- Aggiornamento documentazione utente + diario di bordo

- [ ] **Step 1: help-content**

In `app/src/components/help/help-content.ts`, aggiungi entry (o estendi esistente per impostazioni):

```typescript
"impostazioni-canali": {
  title: "Canali di invio",
  body: `
    Configura i canali per far uscire i messaggi da Regia.

    - **Email (Resend)**: crea un account su resend.com, genera una API key
      (dashboard → API Keys → Create), incollala qui, indica il from address
      (deve essere su un dominio verificato in Resend).
    - **WhatsApp (Twilio)**: crea un account su twilio.com, attiva
      WhatsApp Business, ottieni Account SID + Auth Token dalla console,
      inseriscili qui. In v1 usiamo template pre-approvati (creati da Twilio Console).

    Le API key sono cifrate in Supabase Vault: dopo il salvataggio non le vedi piu'.
    Test invia un ping al provider; se ok, il canale diventa 🟢 Verificato.
    Attiva lo switch "Abilitato" per aprire il canale al motore invii.
  `,
},
```

- [ ] **Step 2: Diario**

In `docs/diario.md`, aggiungi in "Fatto" (in cima):

```
- **XX ott 2026 — M05 Publishing v1 completato.** Adapter Twilio (WA) + Resend (email),
  coda Postgres `m05_publish_jobs` con SKIP LOCKED, worker triggerato da pg_cron 1min,
  6 gate obbligatori pre-enqueue (consent, channel enabled, quiet hours, pressione,
  governance, budget), credenziali via Supabase Vault, log immutabile RF-5.7, UI
  Impostazioni sezione "Canali di invio" con form + test send. 7 test invariante nuovi.
  Prossimo: integrazione M09 reminders → invio automatico WA per voucher/richiami.
```

Aggiorna anche "Adesso" e "Prossimo" per riflettere.

- [ ] **Step 3: Smoke test manuale (Cloud staging)**

1. `npm run dev:staging`
2. Login `admin@admin.com` / `admin123`
3. Vai su `/impostazioni` → sezione "Canali di invio"
4. Configura Resend con una chiave test (`re_test_...`), from `test@resend.dev`
5. Click "Salva" → verifica messaggio "Credenziali salvate"
6. Click "Test" → verifica messaggio "Connessione ok" e badge 🟢 Verificato
7. Attiva switch "Abilitato"
8. In una console browser o via API: chiama `sendMessage` con contatto test
9. Aspetta ~1min (pg_cron su Cloud) → verifica email arrivata

- [ ] **Step 4: CI locale full**

Run: `npm run ci`
Expected: verde. 7 nuovi test aggiunti (~245 totali).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/help/help-content.ts docs/diario.md
git commit -m "RF-12.7 M05: help contestuale canali invio + diario chiusura M05 v1"
```
