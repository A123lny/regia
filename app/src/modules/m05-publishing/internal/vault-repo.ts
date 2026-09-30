// M05 - accesso a Supabase Vault per credenziali provider (RNF-1).
// Il vault schema e' esposto in config.toml (api.schemas). Usiamo le
// funzioni built-in `vault.create_secret` / `vault.update_secret` che
// sono gia' SECURITY DEFINER come supabase_admin.

import { getAdminClient } from "@/lib/db/admin";

/**
 * Crea un secret in vault.secrets. Ritorna l'id UUID.
 * Il nome e' descrittivo (es. "m05_email_resend_<org>_<timestamp>") per audit.
 */
export async function createVaultSecret(value: string, name: string, description?: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin.schema("vault").rpc("create_secret", {
    new_secret: value,
    new_name: name,
    new_description: description ?? "",
  });
  if (error) throw new Error(`Vault createSecret: ${error.message}`);
  return data as string;
}

/** Legge il secret decifrato. Solo service_role. */
export async function decryptVaultSecret(secretId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .schema("vault").from("decrypted_secrets")
    .select("decrypted_secret").eq("id", secretId).maybeSingle();
  if (error) throw new Error(`Vault decryptSecret: ${error.message}`);
  if (!data) throw new Error(`Vault decryptSecret: secret ${secretId} not found`);
  return data.decrypted_secret as string;
}

/** Aggiorna il valore mantenendo lo stesso id. */
export async function updateVaultSecret(secretId: string, newValue: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin.schema("vault").rpc("update_secret", {
    secret_id: secretId,
    new_secret: newValue,
    new_name: null,
    new_description: null,
  });
  if (error) throw new Error(`Vault updateSecret: ${error.message}`);
}

/** Elimina il secret. */
export async function deleteVaultSecret(secretId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .schema("vault").from("secrets").delete().eq("id", secretId);
  if (error) throw new Error(`Vault deleteSecret: ${error.message}`);
}
