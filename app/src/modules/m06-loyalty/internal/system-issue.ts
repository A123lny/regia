// M06 — emissione voucher system-level (no auth session).
// Usato da m10-signup (landing pubbliche): il chiamante deve garantire il proprio
// contesto di autorizzazione (rate-limit, dedup, ecc.) — qui c'è solo la logica
// pura di emissione + persistenza.

import { insertVoucher } from "./vouchers-repo";
import { getOffer } from "./offers-repo";
import { generateVoucherCode } from "./loyalty-types";
import { getAdminClient } from "@/lib/db/admin";

export type IssueSystemVoucherInput = {
  organizationId: string;
  offerId: string;
  contactId: string;
  notes?: string;
};

export type IssueSystemVoucherResult =
  { ok: true; voucherId: string; code: string } | { ok: false; error: string };

/**
 * Emette un voucher benvenuto in modalità system (nessun session/audit check qui).
 * Codice generato con retry anti-collisione, scadenza dall'offerta.
 * Il chiamante è responsabile per audit trail nel proprio dominio.
 */
export async function issueVoucherForSignup(
  input: IssueSystemVoucherInput,
): Promise<IssueSystemVoucherResult> {
  const offer = await getOffer(input.offerId, input.organizationId);
  if (!offer) return { ok: false, error: "Offerta non trovata" };
  if (!offer.isActive) return { ok: false, error: "Offerta non attiva" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  // Retry codice unico
  let code = "";
  for (let i = 0; i < 5; i++) {
    code = generateVoucherCode();
    const { data: dup } = await admin
      .from("vouchers")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("code", code)
      .maybeSingle();
    if (!dup) break;
  }
  if (!code) return { ok: false, error: "Impossibile generare codice univoco" };

  const expiresAt = new Date(
    Date.now() + offer.defaultExpiresDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const issueInput: Parameters<typeof insertVoucher>[0] = {
      organizationId: input.organizationId,
      offerId: input.offerId,
      contactId: input.contactId,
      code,
      rewardKind: offer.rewardKind,
      expiresAtIso: expiresAt,
    };
    if (offer.rewardValueCents !== null) issueInput.rewardValueCents = offer.rewardValueCents;
    if (offer.rewardPct !== null) issueInput.rewardPct = offer.rewardPct;
    if (offer.rewardLabel !== null) issueInput.rewardLabel = offer.rewardLabel;
    if (input.notes !== undefined) issueInput.notes = input.notes;

    const voucher = await insertVoucher(issueInput);
    return { ok: true, voucherId: voucher.id, code: voucher.code };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
