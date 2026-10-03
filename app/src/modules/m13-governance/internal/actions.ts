"use server";

// M13 — server actions per aggiornare regole autonomia e flag discount_forbidden.

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { updateAutonomyLevel, setProductDiscountForbidden } from "./autonomy-repo";
import type { AutonomyLevel } from "./governance-types";

/**
 * Security helper: verifica che un entity (brands, delivery_zones, campaigns...)
 * appartenga alla organization del chiamante. Previene IDOR cross-tenant
 * sui FK client-supplied in server actions.
 * Lancia Error ("Risorsa non trovata") in caso di mismatch.
 */
async function assertEntityOwnedByOrg(
  table: string,
  id: string,
  organizationId: string,
  humanName: string = "Risorsa",
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`verifica ${humanName}: ${error.message}`);
  if (!data) throw new Error(`${humanName} non trovata o appartenente ad altra organizzazione`);
}

async function requireAuth(cap: Capability) {
  const session = await getSessionOrRedirect();
  requireCapability(session, cap);
  return session;
}

export async function updateAutonomyRuleAction(input: {
  kind: string;
  level: AutonomyLevel;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth("governance.crud");
  try {
    const rule = await updateAutonomyLevel(
      session.organizationId,
      input.kind,
      input.level,
      session.userId,
    );
    if (!rule) return { ok: false, error: "Regola non trovata" };

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "governance.autonomy_level_updated",
      target: `rule:${input.kind}`,
      details: { newLevel: input.level, enforcedInCode: rule.enforcedInCode },
    });

    revalidatePath("/governance");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function toggleProductDiscountForbiddenAction(input: {
  productId: string;
  forbidden: boolean;
  reason?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth("governance.crud");
  if (input.forbidden && (!input.reason || input.reason.trim().length === 0)) {
    return { ok: false, error: "Attivando il blocco serve un motivo" };
  }
  try {
    await setProductDiscountForbidden(
      input.productId,
      session.organizationId,
      input.forbidden,
      input.forbidden ? (input.reason ?? "").trim() : null,
    );
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.forbidden
        ? "governance.product_discount_locked"
        : "governance.product_discount_unlocked",
      target: `product:${input.productId}`,
      details: { reason: input.forbidden ? input.reason : null },
    });
    revalidatePath("/governance");
    revalidatePath("/catalogo");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// RF-13.x Advertising (motore promo con tetti spesa)
// ============================================================================

import {
  upsertAdvertisingBudget,
  toggleAdvertisingCategory,
  classifyDraftForAdvertising,
  createOverrunRequest,
  decideOverrunRequest,
  type AdCategory,
  type AdClassification,
} from "./advertising-repo";

export async function upsertAdvertisingBudgetAction(input: {
  brandId: string;
  category: AdCategory;
  monthlyCapCents: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "advertising.budgets.manage");
  if (input.monthlyCapCents < 0) {
    return { ok: false, error: "Tetto non puo' essere negativo" };
  }
  try {
    await assertEntityOwnedByOrg("brands", input.brandId, session.organizationId, "Marchio");
    await upsertAdvertisingBudget({
      organizationId: session.organizationId,
      brandId: input.brandId,
      category: input.category,
      monthlyCapCents: input.monthlyCapCents,
      updatedBy: session.userId,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "advertising.budget_updated",
      target: `brand:${input.brandId}:${input.category}`,
      details: { monthlyCapCents: input.monthlyCapCents },
    });
    revalidatePath("/governance/advertising");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function toggleAdvertisingCategoryAction(input: {
  brandId: string;
  category: AdCategory;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "advertising.toggle");
  try {
    await assertEntityOwnedByOrg("brands", input.brandId, session.organizationId, "Marchio");
    await toggleAdvertisingCategory(
      session.organizationId,
      input.brandId,
      input.category,
      input.enabled,
      session.userId,
    );
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.enabled ? "advertising.category_enabled" : "advertising.category_disabled",
      target: `brand:${input.brandId}:${input.category}`,
    });
    revalidatePath("/governance/advertising");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function classifyDraftForAdvertisingAction(input: {
  draftId: string;
  classification: AdClassification;
  category: AdCategory | null;
  estimatedSpendCents: number | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "advertising.classify");
  try {
    await assertEntityOwnedByOrg(
      "content_drafts",
      input.draftId,
      session.organizationId,
      "Bozza contenuto",
    );
    await classifyDraftForAdvertising({
      organizationId: session.organizationId,
      draftId: input.draftId,
      classification: input.classification,
      category: input.category,
      estimatedSpendCents: input.estimatedSpendCents,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "advertising.draft_classified",
      target: `draft:${input.draftId}`,
      details: {
        classification: input.classification,
        category: input.category,
        estimatedSpendCents: input.estimatedSpendCents,
      },
    });
    revalidatePath("/contenuti");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function requestAdvertisingOverrunAction(input: {
  brandId: string;
  category: AdCategory;
  draftId?: string;
  campaignId?: string;
  requestedAmountCents: number;
  motivation: string;
}): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "advertising.overrun.request");
  try {
    await assertEntityOwnedByOrg("brands", input.brandId, session.organizationId, "Marchio");
    if (input.draftId) {
      await assertEntityOwnedByOrg(
        "content_drafts",
        input.draftId,
        session.organizationId,
        "Bozza contenuto",
      );
    }
    if (input.campaignId) {
      await assertEntityOwnedByOrg(
        "campaigns",
        input.campaignId,
        session.organizationId,
        "Campagna",
      );
    }
    const req = await createOverrunRequest({
      organizationId: session.organizationId,
      brandId: input.brandId,
      category: input.category,
      ...(input.draftId ? { draftId: input.draftId } : {}),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      requestedAmountCents: input.requestedAmountCents,
      motivation: input.motivation,
      requestedBy: session.userId,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "advertising.overrun_requested",
      target: `request:${req.id}`,
      details: {
        brandId: input.brandId,
        category: input.category,
        requestedAmountCents: input.requestedAmountCents,
      },
    });
    revalidatePath("/governance/advertising");
    return { ok: true, requestId: req.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function decideAdvertisingOverrunAction(input: {
  requestId: string;
  decision: "approved" | "rejected";
  notes?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "advertising.overrun.decide");
  try {
    const result = await decideOverrunRequest({
      organizationId: session.organizationId,
      requestId: input.requestId,
      decision: input.decision,
      decidedBy: session.userId,
      ...(input.notes ? { notes: input.notes } : {}),
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: `advertising.overrun_${input.decision}`,
      target: `request:${input.requestId}`,
      details: {
        brandId: result.brandId,
        category: result.category,
        requestedAmountCents: result.requestedAmountCents,
      },
    });
    revalidatePath("/governance/advertising");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// RF-6.18 + RN-41..43 Capacita rider (Lenny food)
// ============================================================================

import {
  upsertRiderCapacityWindow,
  updateFilledSlots,
  deleteRiderCapacityWindow,
  createRiderShiftRequest,
  updateShiftRequestFilled,
  cancelShiftRequest,
  type Weekday,
} from "./rider-capacity-repo";

export async function upsertRiderCapacityWindowAction(input: {
  brandId: string;
  weekday: Weekday;
  timeStart: string;
  timeEnd: string;
  slotsTotal: number;
  slotsFilled?: number;
  note?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "rider_capacity.manage");
  if (input.slotsTotal < 0) return { ok: false, error: "slots_total non negativo" };
  try {
    await assertEntityOwnedByOrg("brands", input.brandId, session.organizationId, "Marchio");
    const row: Parameters<typeof upsertRiderCapacityWindow>[0] = {
      organizationId: session.organizationId,
      brandId: input.brandId,
      weekday: input.weekday,
      timeStart: input.timeStart,
      timeEnd: input.timeEnd,
      slotsTotal: input.slotsTotal,
    };
    if (input.slotsFilled !== undefined) row.slotsFilled = input.slotsFilled;
    if (input.note !== undefined) row.note = input.note;
    await upsertRiderCapacityWindow(row);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "rider_capacity.window_updated",
      target: `brand:${input.brandId}:${input.weekday}:${input.timeStart}`,
      details: { slotsTotal: input.slotsTotal, slotsFilled: input.slotsFilled },
    });
    revalidatePath("/governance/capacita-rider");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateRiderCapacityFilledAction(input: {
  windowId: string;
  slotsFilled: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "rider_capacity.manage");
  try {
    await assertEntityOwnedByOrg(
      "rider_capacity_windows",
      input.windowId,
      session.organizationId,
      "Finestra capacita rider",
    );
    await updateFilledSlots(session.organizationId, input.windowId, input.slotsFilled);
    revalidatePath("/governance/capacita-rider");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteRiderCapacityWindowAction(
  windowId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "rider_capacity.manage");
  try {
    await assertEntityOwnedByOrg(
      "rider_capacity_windows",
      windowId,
      session.organizationId,
      "Finestra capacita rider",
    );
    await deleteRiderCapacityWindow(session.organizationId, windowId);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "rider_capacity.window_deleted",
      target: `window:${windowId}`,
    });
    revalidatePath("/governance/capacita-rider");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function createRiderShiftRequestAction(input: {
  brandId: string;
  shiftDate: string;
  timeStart: string;
  timeEnd: string;
  slotsNeeded: number;
  note?: string;
}): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "rider_shift.request");
  if (input.slotsNeeded <= 0) return { ok: false, error: "slots_needed deve essere > 0" };
  try {
    await assertEntityOwnedByOrg("brands", input.brandId, session.organizationId, "Marchio");
    const payload: Parameters<typeof createRiderShiftRequest>[0] = {
      organizationId: session.organizationId,
      brandId: input.brandId,
      shiftDate: input.shiftDate,
      timeStart: input.timeStart,
      timeEnd: input.timeEnd,
      slotsNeeded: input.slotsNeeded,
      createdBy: session.userId,
    };
    if (input.note !== undefined) payload.note = input.note;
    const req = await createRiderShiftRequest(payload);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "rider_shift.request_created",
      target: `request:${req.id}`,
      details: {
        brandId: input.brandId,
        shiftDate: input.shiftDate,
        slotsNeeded: input.slotsNeeded,
      },
    });
    revalidatePath("/governance/capacita-rider");
    return { ok: true, requestId: req.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function fulfillRiderShiftRequestAction(input: {
  requestId: string;
  slotsFilled: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "rider_shift.fulfill");
  try {
    const updated = await updateShiftRequestFilled(
      session.organizationId,
      input.requestId,
      input.slotsFilled,
    );
    if (!updated) return { ok: false, error: "Richiesta non trovata o annullata" };
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "rider_shift.filled_updated",
      target: `request:${input.requestId}`,
      details: { slotsFilled: input.slotsFilled, status: updated.status },
    });
    revalidatePath("/governance/capacita-rider");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function cancelRiderShiftRequestAction(
  requestId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "rider_shift.fulfill");
  try {
    const cancelled = await cancelShiftRequest(session.organizationId, requestId);
    if (!cancelled) return { ok: false, error: "Richiesta non trovata o gia annullata" };
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "rider_shift.cancelled",
      target: `request:${requestId}`,
    });
    revalidatePath("/governance/capacita-rider");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// RN-52 Zone consegna variabili
// ============================================================================

import {
  upsertDeliveryZone,
  deleteDeliveryZone,
  openBlackout,
  closeBlackout,
  type DeliveryBlackoutKind,
} from "./delivery-zones-repo";

export async function upsertDeliveryZoneAction(input: {
  brandId: string;
  zoneId?: string;
  name: string;
  description?: string | null;
  capPrefixes: string[];
}): Promise<{ ok: true; zoneId: string } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "delivery_zones.manage");
  if (input.name.trim().length === 0) return { ok: false, error: "Nome obbligatorio" };
  try {
    // Security: verifica che brandId appartenga a session.organizationId prima
    // di scrivere (anti IDOR cross-tenant su FK). Il repo filtra l'UPDATE con
    // organization_id, ma l'INSERT no e la FK brand_id punterebbe a brand di altra org.
    await assertEntityOwnedByOrg("brands", input.brandId, session.organizationId, "Marchio");
    // Se e' un update (zoneId presente), verifica anche che la zona esista nell'org.
    if (input.zoneId) {
      await assertEntityOwnedByOrg(
        "delivery_zones",
        input.zoneId,
        session.organizationId,
        "Zona di consegna",
      );
    }
    const payload: Parameters<typeof upsertDeliveryZone>[0] = {
      organizationId: session.organizationId,
      brandId: input.brandId,
      name: input.name,
      capPrefixes: input.capPrefixes,
    };
    if (input.zoneId !== undefined) payload.zoneId = input.zoneId;
    if (input.description !== undefined) payload.description = input.description;
    const z = await upsertDeliveryZone(payload);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.zoneId ? "delivery_zone.updated" : "delivery_zone.created",
      target: `zone:${z.id}`,
      details: { name: z.name, capPrefixes: z.capPrefixes },
    });
    revalidatePath("/governance/zone-consegna");
    return { ok: true, zoneId: z.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteDeliveryZoneAction(
  zoneId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "delivery_zones.manage");
  try {
    // Security: verifica ownership prima della delete (defense in depth).
    await assertEntityOwnedByOrg(
      "delivery_zones",
      zoneId,
      session.organizationId,
      "Zona di consegna",
    );
    await deleteDeliveryZone(session.organizationId, zoneId);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "delivery_zone.deleted",
      target: `zone:${zoneId}`,
    });
    revalidatePath("/governance/zone-consegna");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function openBlackoutAction(input: {
  zoneId: string;
  kind: DeliveryBlackoutKind;
  reason?: string;
  endAtIso?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "delivery_zones.blackout.toggle");
  try {
    // Security: verifica che zoneId appartenga alla org del chiamante prima
    // di aprire blackout (anti IDOR: senza, Owner org A potrebbe aprire blackout
    // su zone di org B passando il suo zoneId).
    await assertEntityOwnedByOrg(
      "delivery_zones",
      input.zoneId,
      session.organizationId,
      "Zona di consegna",
    );
    const payload: Parameters<typeof openBlackout>[0] = {
      organizationId: session.organizationId,
      zoneId: input.zoneId,
      kind: input.kind,
      triggeredBy: session.userId,
    };
    if (input.reason !== undefined) payload.reason = input.reason;
    if (input.endAtIso !== undefined) payload.endAt = input.endAtIso;
    await openBlackout(payload);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "delivery_zone.blackout_opened",
      target: `zone:${input.zoneId}`,
      details: { kind: input.kind, reason: input.reason, endAtIso: input.endAtIso },
    });
    revalidatePath("/governance/zone-consegna");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function closeBlackoutAction(
  blackoutId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "delivery_zones.blackout.toggle");
  try {
    const ok = await closeBlackout(session.organizationId, blackoutId, session.userId);
    if (!ok) return { ok: false, error: "Blackout non trovato o gia chiuso" };
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "delivery_zone.blackout_closed",
      target: `blackout:${blackoutId}`,
    });
    revalidatePath("/governance/zone-consegna");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
