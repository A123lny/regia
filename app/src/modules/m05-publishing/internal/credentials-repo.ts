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
