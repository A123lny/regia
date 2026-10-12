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
