"use server";

// M03 — RF-12.4 Server actions CRUD ricorrenze annuali.
// Owner-only: le ricorrenze influenzano cosa il sistema propone in home.

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { getBrandById } from "@/modules/m02-brand/public";
import {
  insertRecurrence,
  updateRecurrenceRow,
  deleteRecurrenceRow,
  type RecurringEvent,
  type RecurringEventKind,
} from "./recurring-events-repo";

const VALID_KINDS: RecurringEventKind[] = ["holiday", "seasonal", "business"];

function validate(input: {
  name: string;
  kind: string;
  monthOfYear: number;
  dayOfMonth: number;
  leadTimeDays: number;
  suggestedTheme: string;
}): void {
  if (!input.name.trim() || input.name.length > 100) {
    throw new Error("Nome ricorrenza obbligatorio (max 100 caratteri)");
  }
  if (!(VALID_KINDS as string[]).includes(input.kind)) {
    throw new Error("Tipo non valido (holiday/seasonal/business)");
  }
  if (input.monthOfYear < 1 || input.monthOfYear > 12) {
    throw new Error("Mese fuori range (1-12)");
  }
  if (input.dayOfMonth < 1 || input.dayOfMonth > 31) {
    throw new Error("Giorno fuori range (1-31)");
  }
  if (input.leadTimeDays < 0 || input.leadTimeDays > 90) {
    throw new Error("Preavviso fuori range (0-90 giorni)");
  }
  if (!input.suggestedTheme.trim() || input.suggestedTheme.length > 500) {
    throw new Error("Tema suggerito obbligatorio (max 500 caratteri)");
  }
}

export async function createRecurrence(input: {
  brandId: string;
  name: string;
  kind: string;
  monthOfYear: number;
  dayOfMonth: number;
  leadTimeDays: number;
  suggestedTheme: string;
}): Promise<RecurringEvent> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");
  validate(input);
  const brand = await getBrandById(session.organizationId, input.brandId);
  if (!brand) throw new Error("Marchio non trovato");

  const created = await insertRecurrence({
    organizationId: session.organizationId,
    brandId: input.brandId,
    name: input.name.trim(),
    kind: input.kind as RecurringEventKind,
    monthOfYear: input.monthOfYear,
    dayOfMonth: input.dayOfMonth,
    leadTimeDays: input.leadTimeDays,
    suggestedTheme: input.suggestedTheme.trim(),
  });

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.recurrence_created",
    target: `brand:${brand.slug}`,
    details: { recurrenceId: created.id, name: created.name },
  });

  revalidatePath("/impostazioni/ricorrenze");
  revalidatePath("/dashboard");
  return created;
}

export async function updateRecurrence(
  id: string,
  patch: {
    name?: string;
    kind?: string;
    monthOfYear?: number;
    dayOfMonth?: number;
    leadTimeDays?: number;
    suggestedTheme?: string;
    isActive?: boolean;
  },
): Promise<RecurringEvent> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");

  // Validation selettiva sui campi passati
  if (patch.name !== undefined && (!patch.name.trim() || patch.name.length > 100)) {
    throw new Error("Nome non valido");
  }
  if (patch.kind !== undefined && !(VALID_KINDS as string[]).includes(patch.kind)) {
    throw new Error("Tipo non valido");
  }
  if (patch.monthOfYear !== undefined && (patch.monthOfYear < 1 || patch.monthOfYear > 12)) {
    throw new Error("Mese fuori range");
  }
  if (patch.dayOfMonth !== undefined && (patch.dayOfMonth < 1 || patch.dayOfMonth > 31)) {
    throw new Error("Giorno fuori range");
  }
  if (patch.leadTimeDays !== undefined && (patch.leadTimeDays < 0 || patch.leadTimeDays > 90)) {
    throw new Error("Preavviso fuori range");
  }

  const updated = await updateRecurrenceRow(session.organizationId, id, {
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.kind !== undefined ? { kind: patch.kind as RecurringEventKind } : {}),
    ...(patch.monthOfYear !== undefined ? { monthOfYear: patch.monthOfYear } : {}),
    ...(patch.dayOfMonth !== undefined ? { dayOfMonth: patch.dayOfMonth } : {}),
    ...(patch.leadTimeDays !== undefined ? { leadTimeDays: patch.leadTimeDays } : {}),
    ...(patch.suggestedTheme !== undefined ? { suggestedTheme: patch.suggestedTheme.trim() } : {}),
    ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
  });
  if (!updated) throw new Error("Ricorrenza non trovata");

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.recurrence_updated",
    target: `brand:${updated.brandSlug}`,
    details: { recurrenceId: id, patch },
  });

  revalidatePath("/impostazioni/ricorrenze");
  revalidatePath("/dashboard");
  return updated;
}

export async function deleteRecurrence(id: string): Promise<void> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");
  const removed = await deleteRecurrenceRow(session.organizationId, id);
  if (!removed) throw new Error("Ricorrenza non trovata");

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.recurrence_deleted",
    target: `recurrence:${id}`,
    details: {},
  });

  revalidatePath("/impostazioni/ricorrenze");
  revalidatePath("/dashboard");
}
