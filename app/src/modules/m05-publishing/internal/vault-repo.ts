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
