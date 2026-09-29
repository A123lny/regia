// M11 — RF-11.4 Interruttore arresto AI + RF-11.5 tetti spesa.
// Query e mutation su organizations.ai_kill_switch + ai_spend_ledger.

import { getAdminClient } from "@/lib/db/admin";

export type AiSafetyStatus = {
  killSwitchOn: boolean;
  killSwitchUpdatedAt: string | null;
  killSwitchReason: string | null;
};

export class AiKillSwitchError extends Error {
  constructor(reason: string | null) {
    super(
      reason
        ? `Generazioni AI sospese: ${reason}`
        : "Generazioni AI sospese dall'Owner. Riattiva da /impostazioni.",
    );
    this.name = "AiKillSwitchError";
  }
}

/**
 * Guardia principale: chiamare PRIMA di ogni call AI (generateText, embedText,
 * template rendering). Throw AiKillSwitchError se il kill switch è attivo.
 */
export async function assertAiEnabled(organizationId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("organizations")
    .select("ai_kill_switch, ai_kill_switch_reason")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore verifica AI kill switch: ${error.message}`);
  if (data?.ai_kill_switch === true) {
    throw new AiKillSwitchError(data.ai_kill_switch_reason ?? null);
  }
}

export async function getAiSafetyStatus(organizationId: string): Promise<AiSafetyStatus> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("organizations")
    .select("ai_kill_switch, ai_kill_switch_updated_at, ai_kill_switch_reason")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore stato AI safety: ${error.message}`);
  return {
    killSwitchOn: data?.ai_kill_switch === true,
    killSwitchUpdatedAt: data?.ai_kill_switch_updated_at ?? null,
    killSwitchReason: data?.ai_kill_switch_reason ?? null,
  };
}

export async function setAiKillSwitch(
  organizationId: string,
  on: boolean,
  reason: string | null,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("organizations")
    .update({
      ai_kill_switch: on,
      ai_kill_switch_updated_at: new Date().toISOString(),
      ai_kill_switch_reason: on ? reason : null,
    })
    .eq("id", organizationId);
  if (error) throw new Error(`Errore aggiornamento kill switch: ${error.message}`);
}
