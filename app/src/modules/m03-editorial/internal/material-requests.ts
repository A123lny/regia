"use server";

// M03 — RF-3.9 Repository + server actions per richieste materiali.
// Owner + Editor possono creare/marcare fulfilled (content.generate).
// Owner puo anche eliminare (content.delete).

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";

export type MaterialRequestStatus = "open" | "fulfilled" | "cancelled";

export type MaterialRequest = {
  id: string;
  organizationId: string;
  brandId: string;
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  draftId: string;
  draftThemeInput: string;
  description: string;
  neededByDate: string | null;
  status: MaterialRequestStatus;
  assignedTo: string | null;
  fulfilledAt: string | null;
  fulfilledNote: string | null;
  createdAt: string;
  createdBy: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRequest(row: any): MaterialRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    brandSlug: row.brands.slug,
    brandDisplayName: row.brands.display_name,
    brandColor: row.brands.color,
    draftId: row.draft_id,
    draftThemeInput: row.content_drafts.theme_input,
    description: row.description,
    neededByDate: row.needed_by_date ?? null,
    status: row.status as MaterialRequestStatus,
    assignedTo: row.assigned_to ?? null,
    fulfilledAt: row.fulfilled_at ?? null,
    fulfilledNote: row.fulfilled_note ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by ?? null,
  };
}

export async function listOpenMaterialRequests(organizationId: string): Promise<MaterialRequest[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("content_material_requests")
    .select(
      "id, organization_id, brand_id, draft_id, description, needed_by_date, status, assigned_to, fulfilled_at, fulfilled_note, created_at, created_by, brands!inner(slug, display_name, color, is_archived), content_drafts!inner(theme_input)",
    )
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .eq("brands.is_archived", false)
    .order("needed_by_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Errore lettura richieste materiali: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToRequest);
}

export async function createMaterialRequest(input: {
  draftId: string;
  description: string;
  neededByDate?: string;
  assignedTo?: string;
}): Promise<MaterialRequest> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");

  const description = input.description.trim();
  if (description.length < 3 || description.length > 500) {
    throw new Error("Descrizione richiesta materiale: 3-500 caratteri");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  // Verifica ownership del draft
  const { data: draft } = await admin
    .from("content_drafts")
    .select("id, brand_id, organization_id")
    .eq("id", input.draftId)
    .maybeSingle();
  if (!draft) throw new Error("Bozza non trovata");
  if (draft.organization_id !== session.organizationId) {
    throw new Error("Accesso negato alla bozza");
  }

  const insertRow: Record<string, unknown> = {
    organization_id: session.organizationId,
    brand_id: draft.brand_id,
    draft_id: input.draftId,
    description,
    created_by: session.userId,
  };
  if (input.neededByDate) insertRow["needed_by_date"] = input.neededByDate;
  if (input.assignedTo) insertRow["assigned_to"] = input.assignedTo.trim().slice(0, 100);

  const { data, error } = await admin
    .from("content_material_requests")
    .insert(insertRow)
    .select(
      "id, organization_id, brand_id, draft_id, description, needed_by_date, status, assigned_to, fulfilled_at, fulfilled_note, created_at, created_by, brands!inner(slug, display_name, color), content_drafts!inner(theme_input)",
    )
    .single();
  if (error) throw new Error(`Errore creazione richiesta: ${error.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.material_requested",
    target: `draft:${input.draftId}`,
    details: { description, neededByDate: input.neededByDate ?? null },
  });

  revalidatePath("/dashboard");
  return rowToRequest(data);
}

export async function fulfillMaterialRequest(requestId: string, note?: string): Promise<void> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: existing } = await admin
    .from("content_material_requests")
    .select("id, organization_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!existing) throw new Error("Richiesta non trovata");
  if (existing.organization_id !== session.organizationId) {
    throw new Error("Accesso negato");
  }
  if (existing.status !== "open") return;

  const { error } = await admin
    .from("content_material_requests")
    .update({
      status: "fulfilled",
      fulfilled_at: new Date().toISOString(),
      fulfilled_note: note?.trim().slice(0, 500) ?? null,
    })
    .eq("id", requestId);
  if (error) throw new Error(`Errore aggiornamento: ${error.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.material_fulfilled",
    target: `material:${requestId}`,
    details: { note: note ?? null },
  });

  revalidatePath("/dashboard");
}

export async function cancelMaterialRequest(requestId: string): Promise<void> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: existing } = await admin
    .from("content_material_requests")
    .select("id, organization_id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!existing) throw new Error("Richiesta non trovata");
  if (existing.organization_id !== session.organizationId) {
    throw new Error("Accesso negato");
  }
  if (existing.status !== "open") return;

  const { error } = await admin
    .from("content_material_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId);
  if (error) throw new Error(`Errore annullamento: ${error.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "editorial.material_cancelled",
    target: `material:${requestId}`,
    details: {},
  });

  revalidatePath("/dashboard");
}
