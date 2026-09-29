"use server";

// M09 — server actions per reminders.

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { getReminder, markReminderSent, dismissReminder } from "./reminders-repo";
import { refreshAllReminders } from "./compute-engine";
import { detectAllAbandonmentSignals } from "./abandonment-detector";
import { resolveAbandonmentSignal } from "./abandonment-repo";

async function requireAuth(cap: Capability) {
  const session = await getSessionOrRedirect();
  requireCapability(session, cap);
  return session;
}

export async function dismissReminderAction(
  reminderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth("reminders.crud");
  const reminder = await getReminder(reminderId, session.organizationId);
  if (!reminder) return { ok: false, error: "Promemoria non trovato" };
  const updated = await dismissReminder(reminderId, session.organizationId);
  if (!updated) return { ok: false, error: "Promemoria non più in stato pending" };
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "reminders.dismissed",
    target: `reminder:${reminderId}`,
    details: { kind: reminder.kind },
  });
  revalidatePath("/promemoria");
  return { ok: true };
}

export async function markReminderSentAction(
  reminderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth("reminders.crud");
  const reminder = await getReminder(reminderId, session.organizationId);
  if (!reminder) return { ok: false, error: "Promemoria non trovato" };
  const updated = await markReminderSent(reminderId, session.organizationId);
  if (!updated) return { ok: false, error: "Promemoria non più in stato pending" };
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "reminders.marked_sent",
    target: `reminder:${reminderId}`,
    details: { kind: reminder.kind, contactId: reminder.contactId },
  });
  revalidatePath("/promemoria");
  return { ok: true };
}

export type RefreshAllRemindersResult = {
  ok: true;
  serviceCall: { created: number; skipped: number };
  voucherExpiring: { created: number; skipped: number };
  dormant: { created: number; skipped: number };
  counterClose: { created: number; skipped: number };
  totalCreated: number;
};

export async function refreshAllRemindersAction(): Promise<
  RefreshAllRemindersResult | { ok: false; error: string }
> {
  const session = await requireAuth("reminders.refresh");
  try {
    const result = await refreshAllReminders(session.organizationId);
    const totalCreated =
      result.serviceCall.created +
      result.voucherExpiring.created +
      result.dormant.created +
      result.counterClose.created;
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "reminders.refresh_all",
      details: {
        totalCreated,
        breakdown: {
          serviceCall: result.serviceCall,
          voucherExpiring: result.voucherExpiring,
          dormant: result.dormant,
          counterClose: result.counterClose,
        },
      },
    });
    revalidatePath("/promemoria");
    return { ok: true, ...result, totalCreated };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// M9 Anti-abbandono (RN-40)
// ============================================================================

export type DetectAbandonmentResult = {
  ok: true;
  skippedWeek: { created: number; skipped: number };
  droppedFrequency: { created: number; skipped: number };
  silenceInactivity: { created: number; skipped: number };
  totalCreated: number;
};

export async function detectAbandonmentAction(): Promise<
  DetectAbandonmentResult | { ok: false; error: string }
> {
  const session = await requireAuth("abandonment.detect");
  try {
    const result = await detectAllAbandonmentSignals(session.organizationId);
    const totalCreated =
      result.skippedWeek.created +
      result.droppedFrequency.created +
      result.silenceInactivity.created;
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "abandonment.detect_run",
      details: { totalCreated, breakdown: result },
    });
    revalidatePath("/anti-abbandono");
    return { ok: true, ...result, totalCreated };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function resolveAbandonmentSignalAction(input: {
  signalId: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireAuth("abandonment.resolve");
  if (!input.reason || input.reason.trim().length < 3) {
    return { ok: false, error: "Motivo obbligatorio (min 3 caratteri)" };
  }
  const updated = await resolveAbandonmentSignal(
    input.signalId,
    session.organizationId,
    input.reason.trim(),
  );
  if (!updated) return { ok: false, error: "Segnale non trovato o già risolto" };
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "abandonment.resolved",
    target: `signal:${input.signalId}`,
    details: { kind: updated.kind, reason: input.reason.trim() },
  });
  revalidatePath("/anti-abbandono");
  return { ok: true };
}
