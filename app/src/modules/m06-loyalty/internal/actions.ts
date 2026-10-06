"use server";

// M06 — server actions per contatori, offerte, voucher.
// Ogni action: requireCapability + ownership check + audit log + revalidatePath.

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { upsertCounter } from "./counters-repo";
import { upsertOffer, getOffer } from "./offers-repo";
import {
  insertVoucher,
  redeemVoucherAtomic,
  cancelVoucher,
  getVoucher,
  getVoucherByCode,
} from "./vouchers-repo";
import {
  generateVoucherCode,
  type CounterKind,
  type CounterResetMode,
  type RewardKind,
} from "./loyalty-types";
import {
  validateOfferAgainstCommercialRules,
  CommercialGuardError,
} from "@/modules/m13-governance/public";
import { scheduleVoucherExpiringReminderOnIssue } from "@/modules/m09-reminders/public";

async function requireAuth(cap: Capability) {
  const session = await getSessionOrRedirect();
  requireCapability(session, cap);
  return session;
}

async function requireOwnedBrand(brandId: string, organizationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .select("id, slug, organization_id, is_archived")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw new Error(`Errore verifica brand: ${error.message}`);
  if (!data) throw new Error("Marchio non trovato");
  if (data.organization_id !== organizationId) throw new Error("Accesso negato al marchio");
  if (data.is_archived) throw new Error("Marchio archiviato");
  return data as { id: string; slug: string; organization_id: string };
}

async function requireOwnedContact(contactId: string, organizationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("contacts")
    .select("id, brand_id, organization_id, first_name, last_name")
    .eq("id", contactId)
    .maybeSingle();
  if (error) throw new Error(`Errore verifica contatto: ${error.message}`);
  if (!data) throw new Error("Contatto non trovato");
  if (data.organization_id !== organizationId) throw new Error("Accesso negato al contatto");
  return data as {
    id: string;
    brand_id: string;
    organization_id: string;
    first_name: string | null;
    last_name: string | null;
  };
}

// ============================================================================
// Counter CRUD
// ============================================================================

export type UpsertCounterActionInput = {
  counterId?: string;
  brandId: string;
  name: string;
  description?: string;
  kind: CounterKind;
  thresholdCount?: number;
  thresholdValueCents?: number;
  resetMode: CounterResetMode;
  isActive: boolean;
};

export async function upsertCounterAction(
  input: UpsertCounterActionInput,
): Promise<{ ok: true; counterId: string } | { ok: false; error: string }> {
  const session = await requireAuth("loyalty.crud.counters");
  await requireOwnedBrand(input.brandId, session.organizationId);

  // Validazione: kind e soglia coerenti (guardia applicativa in aggiunta al check DB)
  if (input.kind === "valore_speso" && !input.thresholdValueCents) {
    return { ok: false, error: "Per 'valore speso' serve una soglia in centesimi" };
  }
  if (input.kind !== "valore_speso" && !input.thresholdCount) {
    return { ok: false, error: "Per questo tipo serve una soglia numerica" };
  }

  try {
    const upsertInput: Parameters<typeof upsertCounter>[0] = {
      organizationId: session.organizationId,
      brandId: input.brandId,
      name: input.name,
      kind: input.kind,
      resetMode: input.resetMode,
      isActive: input.isActive,
    };
    if (input.counterId) upsertInput.counterId = input.counterId;
    if (input.description !== undefined) upsertInput.description = input.description;
    if (input.thresholdCount !== undefined) upsertInput.thresholdCount = input.thresholdCount;
    if (input.thresholdValueCents !== undefined)
      upsertInput.thresholdValueCents = input.thresholdValueCents;

    const counter = await upsertCounter(upsertInput);

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.counterId ? "loyalty.counter_updated" : "loyalty.counter_created",
      target: `brand:${input.brandId}`,
      details: { counterId: counter.id, name: counter.name, kind: counter.kind },
    });

    revalidatePath("/fedelta");
    revalidatePath("/fedelta/contatori");
    return { ok: true, counterId: counter.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// Offer CRUD
// ============================================================================

export type UpsertOfferActionInput = {
  offerId?: string;
  issuerBrandId: string;
  spendableBrandId: string;
  counterId?: string;
  name: string;
  description?: string;
  rewardKind: RewardKind;
  rewardValueCents?: number;
  rewardPct?: number;
  rewardLabel?: string;
  defaultExpiresDays: number;
  cumulable: boolean;
  isActive: boolean;
  /**
   * Se true, l'Owner conferma esplicitamente di voler procedere anche se
   * il brand spendibile contiene prodotti a sconto vietato (RF-6.15..6.17).
   * L'override è audit-loggato con dettagli.
   */
  confirmCommercialGuardOverride?: boolean;
};

export async function upsertOfferAction(
  input: UpsertOfferActionInput,
): Promise<{ ok: true; offerId: string } | { ok: false; error: string; guard?: true }> {
  const session = await requireAuth("loyalty.crud.offers");
  await requireOwnedBrand(input.issuerBrandId, session.organizationId);
  await requireOwnedBrand(input.spendableBrandId, session.organizationId);

  // Validazione reward coerente (doppio con check DB)
  if (input.rewardKind === "valore_fisso" && !input.rewardValueCents) {
    return { ok: false, error: "Valore fisso: serve importo in centesimi" };
  }
  if (
    input.rewardKind === "percentuale" &&
    (input.rewardPct === undefined || input.rewardPct <= 0)
  ) {
    return { ok: false, error: "Percentuale: serve valore > 0" };
  }
  if (input.rewardKind === "servizio_gratis" && !input.rewardLabel) {
    return { ok: false, error: "Servizio gratis: serve etichetta descrittiva" };
  }

  // RF-6.15..6.17 guardia commerciale via m13-governance
  try {
    await validateOfferAgainstCommercialRules({
      organizationId: session.organizationId,
      spendableBrandId: input.spendableBrandId,
      rewardKind: input.rewardKind,
      confirmOverride: input.confirmCommercialGuardOverride ?? false,
    });
  } catch (err) {
    if (err instanceof CommercialGuardError) {
      return { ok: false, error: err.message, guard: true };
    }
    throw err;
  }

  try {
    const upsertInput: Parameters<typeof upsertOffer>[0] = {
      organizationId: session.organizationId,
      issuerBrandId: input.issuerBrandId,
      spendableBrandId: input.spendableBrandId,
      name: input.name,
      rewardKind: input.rewardKind,
      defaultExpiresDays: input.defaultExpiresDays,
      cumulable: input.cumulable,
      isActive: input.isActive,
    };
    if (input.offerId) upsertInput.offerId = input.offerId;
    if (input.counterId !== undefined) upsertInput.counterId = input.counterId;
    if (input.description !== undefined) upsertInput.description = input.description;
    if (input.rewardValueCents !== undefined) upsertInput.rewardValueCents = input.rewardValueCents;
    if (input.rewardPct !== undefined) upsertInput.rewardPct = input.rewardPct;
    if (input.rewardLabel !== undefined) upsertInput.rewardLabel = input.rewardLabel;

    const offer = await upsertOffer(upsertInput);

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.offerId ? "loyalty.offer_updated" : "loyalty.offer_created",
      target: `brand:${input.issuerBrandId}`,
      details: {
        offerId: offer.id,
        name: offer.name,
        rewardKind: offer.rewardKind,
        spendableBrandId: input.spendableBrandId,
        // Traccia esplicita override guardia commerciale (RF-6.15..6.17)
        commercialGuardOverride: input.confirmCommercialGuardOverride ?? false,
      },
    });

    revalidatePath("/fedelta");
    revalidatePath("/fedelta/offerte");
    return { ok: true, offerId: offer.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// Voucher issue / redeem / cancel
// ============================================================================

export type IssueVoucherActionInput = {
  offerId: string;
  contactId: string;
  notes?: string;
  sourceDraftId?: string; // RF-9.3 attribuzione contenuto -> vendita
};

export async function issueVoucherAction(
  input: IssueVoucherActionInput,
): Promise<{ ok: true; voucherId: string; code: string } | { ok: false; error: string }> {
  const session = await requireAuth("voucher.issue");
  await requireOwnedContact(input.contactId, session.organizationId);

  const offer = await getOffer(input.offerId, session.organizationId);
  if (!offer) return { ok: false, error: "Offerta non trovata" };
  if (!offer.isActive) return { ok: false, error: "Offerta non attiva" };

  // RF-9.3 attribuzione: se il client passa sourceDraftId, verifichiamo che il
  // draft esista NELL'ORG dell'utente (prevenzione IDOR cross-tenant).
  if (input.sourceDraftId !== undefined) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(input.sourceDraftId)) {
      return { ok: false, error: "Riferimento draft non valido" };
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getAdminClient() as any;
    const { data: draftRow, error: draftErr } = await admin
      .from("content_drafts")
      .select("id")
      .eq("id", input.sourceDraftId)
      .eq("organization_id", session.organizationId)
      .maybeSingle();
    if (draftErr) return { ok: false, error: `verifica draft: ${draftErr.message}` };
    if (!draftRow) {
      return {
        ok: false,
        error: "Draft di origine non trovato o appartenente ad altra organizzazione",
      };
    }
  }

  // Genera codice unico (retry fino a 5 volte in caso di collisione UNIQUE)
  let code = "";
  let attempts = 0;
  while (attempts < 5) {
    code = generateVoucherCode();
    const existing = await getVoucherByCode(code, session.organizationId);
    if (!existing) break;
    attempts++;
  }
  if (attempts === 5) {
    return { ok: false, error: "Impossibile generare codice univoco, riprovare" };
  }

  const expiresAt = new Date(Date.now() + offer.defaultExpiresDays * 24 * 60 * 60 * 1000);

  try {
    const issueInput: Parameters<typeof insertVoucher>[0] = {
      organizationId: session.organizationId,
      offerId: input.offerId,
      contactId: input.contactId,
      code,
      rewardKind: offer.rewardKind,
      expiresAtIso: expiresAt.toISOString(),
    };
    if (offer.rewardValueCents !== null) issueInput.rewardValueCents = offer.rewardValueCents;
    if (offer.rewardPct !== null) issueInput.rewardPct = offer.rewardPct;
    if (offer.rewardLabel !== null) issueInput.rewardLabel = offer.rewardLabel;
    if (input.notes !== undefined) issueInput.notes = input.notes;
    if (input.sourceDraftId !== undefined) issueInput.sourceDraftId = input.sourceDraftId;

    const voucher = await insertVoucher(issueInput);

    // Event-driven: schedula il reminder voucher_expiring per 10gg prima della scadenza.
    // Fallimento non bloccante — il voucher e' emesso con successo, al limite il
    // reminder viene creato dalla scan periodica refreshVoucherExpiringReminders.
    try {
      await scheduleVoucherExpiringReminderOnIssue({
        organizationId: session.organizationId,
        brandId: offer.issuerBrandId,
        contactId: input.contactId,
        voucherId: voucher.id,
        code: voucher.code,
        expiresAtIso: voucher.expiresAt,
      });
    } catch (hookErr) {
      // Log soft (non audit event — gia' loggato il successo voucher). In produzione
      // andrebbe in observability (Sentry/Datadog). Per F1 basta console.
      console.error("scheduleVoucherExpiringReminderOnIssue failed:", (hookErr as Error).message);
    }

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "loyalty.voucher_issued",
      target: `contact:${input.contactId}`,
      details: {
        voucherId: voucher.id,
        code: voucher.code,
        offerId: input.offerId,
        expiresAt: voucher.expiresAt,
      },
    });

    revalidatePath("/fedelta/voucher");
    return { ok: true, voucherId: voucher.id, code };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Riscatto per ID (uso interno da UI). Guardia atomica in DB.
 */
export async function redeemVoucherAction(
  voucherId: string,
  orderId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth("voucher.redeem");
  const voucher = await getVoucher(voucherId, session.organizationId);
  if (!voucher) return { ok: false, error: "Voucher non trovato" };

  const updated = await redeemVoucherAtomic(voucherId, session.organizationId, orderId ?? null);
  if (!updated) {
    return {
      ok: false,
      error:
        "Voucher non riscattabile: già usato, annullato, scaduto o non appartiene alla tua organizzazione (RF-6.26).",
    };
  }

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "loyalty.voucher_redeemed",
    target: `contact:${voucher.contactId}`,
    details: {
      voucherId,
      code: voucher.code,
      orderId: orderId ?? null,
    },
  });

  revalidatePath("/fedelta/voucher");
  return { ok: true };
}

/**
 * Riscatto per codice (banco: input testuale del codice).
 */
export async function redeemVoucherByCodeAction(
  code: string,
  orderId?: string,
): Promise<{ ok: true; contactFullName: string | null } | { ok: false; error: string }> {
  const session = await requireAuth("voucher.redeem");
  const trimmed = code.trim().toUpperCase();
  if (trimmed.length < 4) return { ok: false, error: "Codice troppo corto" };

  const voucher = await getVoucherByCode(trimmed, session.organizationId);
  if (!voucher) return { ok: false, error: "Codice non trovato" };

  const updated = await redeemVoucherAtomic(voucher.id, session.organizationId, orderId ?? null);
  if (!updated) {
    return {
      ok: false,
      error: `Voucher non riscattabile (stato attuale: ${voucher.status}, scadenza: ${new Date(voucher.expiresAt).toLocaleDateString("it-IT")}).`,
    };
  }

  // Recupero nome contatto per feedback UI
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: contact } = await admin
    .from("contacts")
    .select("first_name, last_name")
    .eq("id", voucher.contactId)
    .maybeSingle();
  const parts = [(contact?.first_name as string) ?? "", (contact?.last_name as string) ?? ""]
    .map((p) => p.trim())
    .filter(Boolean);
  const contactFullName = parts.length > 0 ? parts.join(" ") : null;

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "loyalty.voucher_redeemed",
    target: `contact:${voucher.contactId}`,
    details: {
      voucherId: voucher.id,
      code: voucher.code,
      orderId: orderId ?? null,
    },
  });

  revalidatePath("/fedelta/voucher");
  return { ok: true, contactFullName };
}

export async function cancelVoucherAction(
  voucherId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth("voucher.cancel");
  if (!reason || reason.trim().length < 3) {
    return { ok: false, error: "Motivo annullamento obbligatorio (≥3 caratteri)" };
  }

  const voucher = await getVoucher(voucherId, session.organizationId);
  if (!voucher) return { ok: false, error: "Voucher non trovato" };

  const updated = await cancelVoucher(voucherId, session.organizationId, reason.trim());
  if (!updated) {
    return { ok: false, error: "Voucher non annullabile (già usato, scaduto o annullato)" };
  }

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "loyalty.voucher_cancelled",
    target: `contact:${voucher.contactId}`,
    details: { voucherId, code: voucher.code, reason: reason.trim() },
  });

  revalidatePath("/fedelta/voucher");
  return { ok: true };
}
