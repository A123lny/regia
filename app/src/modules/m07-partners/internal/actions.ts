"use server";

// M07 Partners — server actions.

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { upsertPartner, archivePartner, getPartner } from "./partners-repo";
import { createActivity } from "./activities-repo";
import type { ActivityKind, ActivityOutcome, OnboardingStatus } from "./partners-types";
import {
  buildMonthlyPartnerReport,
  formatMonthlyReportMessage,
  type MonthlyPartnerReport,
} from "./monthly-report-builder";
import {
  getPartnerLaunchStatus,
  markPartnerLaunched,
  updatePartnerLaunchNotes,
  type PartnerLaunchStatus,
} from "./launch-tracker";
import {
  recordDeliveryError,
  getPartnerErrorsSummary,
  listPartnerErrors,
  type DeliveryErrorSeverity,
  type DeliveryError,
  type PartnerErrorsSummary,
} from "./delivery-errors-repo";

async function requireAuth(cap: Capability) {
  const session = await getSessionOrRedirect();
  requireCapability(session, cap);
  return session;
}

async function requireOwnedPartner(partnerId: string, cap: Capability) {
  const session = await requireAuth(cap);
  const partner = await getPartner(partnerId, session.organizationId);
  if (!partner) throw new Error("Partner non trovato");
  return { session, partner };
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
  // Guardia F1: solo Lenny può avere partner_restaurants
  if (data.slug !== "lenny") {
    throw new Error("La rete ristoranti è disponibile solo per Lenny in F1");
  }
  return data as { id: string; slug: string };
}

// ============================================================================
// Partner CRUD
// ============================================================================

export type UpsertPartnerActionInput = {
  partnerId?: string;
  brandId: string;
  name: string;
  referentName?: string;
  phone?: string;
  email?: string;
  addressStreet?: string;
  addressCity?: string;
  addressCap?: string;
  cuisineCategory?: string;
  avgPrepMinutes?: number;
  onboardingStatus: OnboardingStatus;
  coolingFlag: boolean;
  coolingReason?: string;
  notes?: string;
};

export async function upsertPartnerAction(
  input: UpsertPartnerActionInput,
): Promise<{ ok: true; partnerId: string } | { ok: false; error: string }> {
  const session = await requireAuth("partner.crud");
  await requireOwnedBrand(input.brandId, session.organizationId);

  if (input.coolingFlag && (!input.coolingReason || input.coolingReason.trim().length === 0)) {
    return { ok: false, error: "Con cooling attivo serve indicare il motivo" };
  }

  try {
    const payload: Parameters<typeof upsertPartner>[0] = {
      organizationId: session.organizationId,
      brandId: input.brandId,
      name: input.name,
      onboardingStatus: input.onboardingStatus,
      coolingFlag: input.coolingFlag,
    };
    if (input.partnerId) payload.partnerId = input.partnerId;
    if (input.referentName !== undefined) payload.referentName = input.referentName;
    if (input.phone !== undefined) payload.phone = input.phone;
    if (input.email !== undefined) payload.email = input.email;
    if (input.addressStreet !== undefined) payload.addressStreet = input.addressStreet;
    if (input.addressCity !== undefined) payload.addressCity = input.addressCity;
    if (input.addressCap !== undefined) payload.addressCap = input.addressCap;
    if (input.cuisineCategory !== undefined) payload.cuisineCategory = input.cuisineCategory;
    if (input.avgPrepMinutes !== undefined) payload.avgPrepMinutes = input.avgPrepMinutes;
    if (input.coolingReason !== undefined) payload.coolingReason = input.coolingReason;
    if (input.notes !== undefined) payload.notes = input.notes;

    const partner = await upsertPartner(payload);

    // RN-48: se il partner passa a 'attivo' per la prima volta, marca launched_at.
    // markPartnerLaunched e' idempotente (setta solo se launched_at e' null),
    // quindi e' sicuro chiamarlo anche su update successivi.
    let launched = false;
    if (partner.onboardingStatus === "attivo") {
      launched = await markPartnerLaunched(session.organizationId, partner.id);
    }

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.partnerId ? "partners.partner_updated" : "partners.partner_created",
      target: `partner:${partner.id}`,
      details: {
        name: partner.name,
        status: partner.onboardingStatus,
        cooling: partner.coolingFlag,
        launched,
      },
    });

    if (launched) {
      await logAuditEvent({
        organizationId: session.organizationId,
        actorUserId: session.userId,
        actorKind: "user",
        action: "partners.partner_launched",
        target: `partner:${partner.id}`,
        details: { name: partner.name },
      });
    }

    revalidatePath("/ristoranti");
    return { ok: true, partnerId: partner.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function archivePartnerAction(partnerId: string): Promise<void> {
  const { session } = await requireOwnedPartner(partnerId, "partner.crud");
  const ok = await archivePartner(partnerId, session.organizationId);
  if (!ok) throw new Error("Partner già archiviato o non trovato");
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "partners.partner_archived",
    target: `partner:${partnerId}`,
    details: {},
  });
  revalidatePath("/ristoranti");
}

// ============================================================================
// Activity log
// ============================================================================

export type LogActivityActionInput = {
  partnerId: string;
  kind: ActivityKind;
  outcome?: ActivityOutcome;
  summary: string;
  occurredAt?: string;
};

export async function logActivityAction(
  input: LogActivityActionInput,
): Promise<{ ok: true; activityId: string } | { ok: false; error: string }> {
  const { session } = await requireOwnedPartner(input.partnerId, "partner.activity.log");
  if (!input.summary || input.summary.trim().length === 0) {
    return { ok: false, error: "Riassunto obbligatorio" };
  }
  try {
    const payload: Parameters<typeof createActivity>[0] = {
      organizationId: session.organizationId,
      partnerId: input.partnerId,
      kind: input.kind,
      summary: input.summary,
      createdBy: session.userId,
    };
    if (input.outcome !== undefined) payload.outcome = input.outcome;
    if (input.occurredAt !== undefined) payload.occurredAt = input.occurredAt;

    const activity = await createActivity(payload);

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "partners.activity_logged",
      target: `partner:${input.partnerId}`,
      details: {
        activityId: activity.id,
        kind: activity.kind,
        outcome: activity.outcome,
      },
    });

    revalidatePath("/ristoranti");
    revalidatePath("/dashboard");
    return { ok: true, activityId: activity.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type ToggleCoolingActionInput = {
  partnerId: string;
  coolingFlag: boolean;
  coolingReason?: string;
};

export async function toggleCoolingAction(
  input: ToggleCoolingActionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session, partner } = await requireOwnedPartner(input.partnerId, "partner.crud");
  if (input.coolingFlag && (!input.coolingReason || input.coolingReason.trim().length === 0)) {
    return { ok: false, error: "Attivando cooling serve indicare il motivo" };
  }
  try {
    const payload: Parameters<typeof upsertPartner>[0] = {
      organizationId: session.organizationId,
      partnerId: partner.id,
      brandId: partner.brandId,
      name: partner.name,
      onboardingStatus: partner.onboardingStatus,
      coolingFlag: input.coolingFlag,
    };
    if (input.coolingFlag && input.coolingReason) {
      payload.coolingReason = input.coolingReason;
    }
    // Preserve altri campi
    if (partner.referentName !== null) payload.referentName = partner.referentName;
    if (partner.phone !== null) payload.phone = partner.phone;
    if (partner.email !== null) payload.email = partner.email;
    if (partner.addressStreet !== null) payload.addressStreet = partner.addressStreet;
    if (partner.addressCity !== null) payload.addressCity = partner.addressCity;
    if (partner.addressCap !== null) payload.addressCap = partner.addressCap;
    if (partner.cuisineCategory !== null) payload.cuisineCategory = partner.cuisineCategory;
    if (partner.avgPrepMinutes !== null) payload.avgPrepMinutes = partner.avgPrepMinutes;
    if (partner.notes !== null) payload.notes = partner.notes;

    await upsertPartner(payload);

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.coolingFlag ? "partners.cooling_on" : "partners.cooling_off",
      target: `partner:${input.partnerId}`,
      details: { reason: input.coolingReason ?? null },
    });

    revalidatePath("/ristoranti");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// RN-28 Errori consegna ristorante
// ============================================================================

export type RecordDeliveryErrorActionInput = {
  partnerId: string;
  reason: string;
  severity?: DeliveryErrorSeverity;
  orderId?: string;
  compensationVoucherId?: string;
  notes?: string;
};

export type RecordDeliveryErrorActionResult =
  { ok: true; error: DeliveryError } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function recordDeliveryErrorAction(
  input: RecordDeliveryErrorActionInput,
): Promise<RecordDeliveryErrorActionResult> {
  try {
    const { session, partner } = await requireOwnedPartner(input.partnerId, "partner.crud");
    if (!input.reason || input.reason.trim().length < 3) {
      return { ok: false, error: "Motivo errore obbligatorio (min 3 caratteri)" };
    }

    // RNF-1 security: prevenzione IDOR cross-tenant. Il client puo' passare
    // orderId e compensationVoucherId: verifichiamo UUID valido + stessa org.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getAdminClient() as any;

    if (input.orderId !== undefined && input.orderId !== null) {
      if (!UUID_RE.test(input.orderId)) {
        return { ok: false, error: "Riferimento ordine non valido" };
      }
      const { data, error: err } = await admin
        .from("brand_orders")
        .select("id")
        .eq("id", input.orderId)
        .eq("organization_id", session.organizationId)
        .maybeSingle();
      if (err) return { ok: false, error: "verifica ordine fallita" };
      if (!data) {
        return {
          ok: false,
          error: "Ordine non trovato o appartenente ad altra organizzazione",
        };
      }
    }

    if (input.compensationVoucherId !== undefined && input.compensationVoucherId !== null) {
      if (!UUID_RE.test(input.compensationVoucherId)) {
        return { ok: false, error: "Riferimento voucher non valido" };
      }
      const { data, error: err } = await admin
        .from("vouchers")
        .select("id")
        .eq("id", input.compensationVoucherId)
        .eq("organization_id", session.organizationId)
        .maybeSingle();
      if (err) return { ok: false, error: "verifica voucher fallita" };
      if (!data) {
        return {
          ok: false,
          error: "Voucher non trovato o appartenente ad altra organizzazione",
        };
      }
    }

    const errRow = await recordDeliveryError({
      organizationId: session.organizationId,
      partnerId: partner.id,
      reason: input.reason,
      severity: input.severity ?? "media",
      orderId: input.orderId ?? null,
      compensationVoucherId: input.compensationVoucherId ?? null,
      reportedBy: session.userId,
      notes: input.notes ?? null,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "partners.delivery_error_recorded",
      target: `partner:${partner.id}`,
      details: {
        errorId: errRow.id,
        severity: errRow.severity,
        hasCompensationVoucher: errRow.compensationVoucherId !== null,
      },
    });
    revalidatePath("/ristoranti");
    return { ok: true, error: errRow };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type GetPartnerErrorsResult =
  | { ok: true; summary: PartnerErrorsSummary; recent: DeliveryError[] }
  | { ok: false; error: string };

export async function getPartnerErrorsAction(partnerId: string): Promise<GetPartnerErrorsResult> {
  try {
    const { session } = await requireOwnedPartner(partnerId, "partner.read");
    const [summary, recent] = await Promise.all([
      getPartnerErrorsSummary(session.organizationId, partnerId),
      listPartnerErrors(session.organizationId, partnerId, 5),
    ]);
    return { ok: true, summary, recent };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// RN-47 Report mensile ristoratori
// ============================================================================

export type GenerateMonthlyReportInput = {
  partnerId: string;
  monthIso?: string; // default = oggi (mese corrente)
};

export type GenerateMonthlyReportResult =
  { ok: true; report: MonthlyPartnerReport; message: string } | { ok: false; error: string };

// ============================================================================
// RN-48 Workflow lancio nuovo ristorante
// ============================================================================

export type GetLaunchStatusResult =
  { ok: true; status: PartnerLaunchStatus } | { ok: false; error: string };

export async function getLaunchStatusAction(partnerId: string): Promise<GetLaunchStatusResult> {
  try {
    const { session } = await requireOwnedPartner(partnerId, "partner.read");
    const status = await getPartnerLaunchStatus(session.organizationId, partnerId);
    if (!status) return { ok: false, error: "Partner non trovato" };
    return { ok: true, status };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type UpdateLaunchNotesInput = {
  partnerId: string;
  notes: string;
};

export async function updateLaunchNotesAction(
  input: UpdateLaunchNotesInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { session, partner } = await requireOwnedPartner(input.partnerId, "partner.crud");
    await updatePartnerLaunchNotes(session.organizationId, partner.id, input.notes);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "partners.launch_notes_updated",
      target: `partner:${partner.id}`,
      details: { length: input.notes.length },
    });
    revalidatePath("/ristoranti");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/**
 * Genera il report mensile per un ristorante partner. Owner-only (partner.crud).
 * Non invia nulla: ritorna payload + testo pronto per preview nel drawer.
 * L'invio effettivo via WhatsApp partira' da un secondo bottone che chiamera'
 * M05 sendMessage (quando Twilio sara' configurato).
 */
export async function generateMonthlyReportAction(
  input: GenerateMonthlyReportInput,
): Promise<GenerateMonthlyReportResult> {
  try {
    const { session, partner } = await requireOwnedPartner(input.partnerId, "partner.crud");

    const report = await buildMonthlyPartnerReport(
      session.organizationId,
      partner.id,
      input.monthIso,
    );
    if (!report) return { ok: false, error: "Impossibile generare il report" };

    const message = formatMonthlyReportMessage(report);

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "partner.monthly_report_generated",
      target: `partner:${partner.id}`,
      details: {
        monthStart: report.monthStartIso,
        ordersThisMonth: report.ordersThisMonth,
        activitiesCount: report.activitiesCount,
        hasOrdersData: report.ordersThisMonth > 0,
      },
    });

    return { ok: true, report, message };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
