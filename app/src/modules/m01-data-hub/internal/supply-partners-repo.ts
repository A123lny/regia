// M6a · repo fornitori (partner spesa Lenny). RF-6.19 + RF-6a.1.

import { getAdminClient } from "@/lib/db/admin";

export type PartnerInvolvementLevel = "informed" | "approves" | "co_finances" | "name_veto";

export const INVOLVEMENT_LEVEL_LABELS: Record<PartnerInvolvementLevel, string> = {
  informed: "Da informare",
  approves: "Deve approvare",
  co_finances: "Cofinanzia",
  name_veto: "Veto sul nome",
};

export const INVOLVEMENT_LEVEL_HINTS: Record<PartnerInvolvementLevel, string> = {
  informed:
    "Preavviso informativo: il partner viene avvisato prima della pubblicazione, non deve approvare.",
  approves:
    "Approvazione esplicita: la pubblicazione resta bloccata finche' il partner conferma (RF-6a.2).",
  co_finances: "Cofinanzia: dovra' approvare l'importo del cofinanziamento oltre al contenuto.",
  name_veto:
    "Veto sul nome: puo' chiedere di cambiare come viene nominato (es. marchio Eni e carburante).",
};

export type SupplyPartner = {
  id: string;
  organizationId: string;
  name: string;
  referentName: string | null;
  phone: string | null;
  email: string | null;
  category: string | null;
  generalConsent: boolean;
  generalConsentNote: string | null;
  involvementLevel: PartnerInvolvementLevel;
  advanceNoticeDays: number;
  vetoNotes: string | null;
  archivedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const SELECT_COLS =
  "id, organization_id, name, referent_name, phone, email, category, " +
  "general_consent, general_consent_note, involvement_level, advance_notice_days, veto_notes, " +
  "archived_at, notes, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPartner(row: any): SupplyPartner {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    referentName: row.referent_name ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    category: row.category ?? null,
    generalConsent: row.general_consent,
    generalConsentNote: row.general_consent_note ?? null,
    involvementLevel: (row.involvement_level as PartnerInvolvementLevel) ?? "informed",
    advanceNoticeDays: Number(row.advance_notice_days ?? 3),
    vetoNotes: row.veto_notes ?? null,
    archivedAt: row.archived_at ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSupplyPartners(
  organizationId: string,
  includeArchived: boolean = false,
): Promise<SupplyPartner[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin.from("supply_partners").select(SELECT_COLS).eq("organization_id", organizationId);
  if (!includeArchived) q = q.is("archived_at", null);
  const { data, error } = await q.order("name", { ascending: true });
  if (error) throw new Error(`Errore lista fornitori: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToPartner);
}

export async function getSupplyPartner(
  partnerId: string,
  organizationId: string,
): Promise<SupplyPartner | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("supply_partners")
    .select(SELECT_COLS)
    .eq("id", partnerId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura fornitore: ${error.message}`);
  return data ? rowToPartner(data) : null;
}

export type UpsertSupplyPartnerInput = {
  organizationId: string;
  partnerId?: string;
  name: string;
  referentName?: string | null;
  phone?: string | null;
  email?: string | null;
  category?: string | null;
  generalConsent: boolean;
  generalConsentNote?: string | null;
  involvementLevel?: PartnerInvolvementLevel;
  advanceNoticeDays?: number;
  vetoNotes?: string | null;
  notes?: string | null;
};

export async function upsertSupplyPartner(input: UpsertSupplyPartnerInput): Promise<SupplyPartner> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    name: input.name.trim(),
    referent_name: input.referentName ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    category: input.category ?? null,
    general_consent: input.generalConsent,
    general_consent_note: input.generalConsent ? (input.generalConsentNote ?? null) : null,
    notes: input.notes ?? null,
  };
  if (input.involvementLevel !== undefined) row["involvement_level"] = input.involvementLevel;
  if (input.advanceNoticeDays !== undefined) row["advance_notice_days"] = input.advanceNoticeDays;
  if (input.vetoNotes !== undefined) row["veto_notes"] = input.vetoNotes;
  if (input.partnerId) {
    const { data, error } = await admin
      .from("supply_partners")
      .update(row)
      .eq("id", input.partnerId)
      .eq("organization_id", input.organizationId)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Update supply partner: ${error.message}`);
    return rowToPartner(data);
  } else {
    const { data, error } = await admin
      .from("supply_partners")
      .insert(row)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Insert supply partner: ${error.message}`);
    return rowToPartner(data);
  }
}

/**
 * RF-6.19 · guardia: cerca prodotti con supply_partner nel brand spendibile
 * che NON hanno general_consent=true. Ritorna la lista dei prodotti bloccanti.
 */
export async function findProductsWithoutPartnerConsent(
  organizationId: string,
  brandId: string,
): Promise<Array<{ sku: string; name: string; partnerName: string }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_products")
    .select("sku, name, supply_partners!inner(name, general_consent)")
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .is("archived_at", null)
    .eq("supply_partners.general_consent", false);
  if (error) throw new Error(`Errore lookup partner consent: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    sku: r.sku as string,
    name: r.name as string,
    partnerName: r.supply_partners.name as string,
  }));
}

// ============================================================================
// RF-6a.1 Partner approval requests (traccia delle risposte)
// ============================================================================

export type PartnerApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export const APPROVAL_STATUS_LABELS: Record<PartnerApprovalStatus, string> = {
  pending: "In attesa",
  approved: "Approvata",
  rejected: "Rifiutata",
  expired: "Scaduta",
};

export type PartnerApprovalSourceKind = "content_draft" | "campaign" | "voucher_offer" | "other";

export type PartnerApprovalRequest = {
  id: string;
  organizationId: string;
  partnerId: string;
  sourceKind: PartnerApprovalSourceKind;
  sourceId: string | null;
  subject: string;
  message: string | null;
  requestedAt: string;
  dueAt: string | null;
  status: PartnerApprovalStatus;
  responseAt: string | null;
  responseNotes: string | null;
};

export type PartnerApprovalRequestRow = PartnerApprovalRequest & {
  partnerName: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToApproval(row: any): PartnerApprovalRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    partnerId: row.partner_id,
    sourceKind: row.source_kind as PartnerApprovalSourceKind,
    sourceId: row.source_id ?? null,
    subject: row.subject,
    message: row.message ?? null,
    requestedAt: row.requested_at,
    dueAt: row.due_at ?? null,
    status: row.status as PartnerApprovalStatus,
    responseAt: row.response_at ?? null,
    responseNotes: row.response_notes ?? null,
  };
}

export async function listPartnerApprovalRequests(
  organizationId: string,
  options?: { partnerId?: string; onlyPending?: boolean },
): Promise<PartnerApprovalRequestRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("partner_approval_requests")
    .select("*, supply_partners!inner(name, organization_id)")
    .eq("organization_id", organizationId)
    .eq("supply_partners.organization_id", organizationId); // RNF-1 defense in depth
  if (options?.partnerId) q = q.eq("partner_id", options.partnerId);
  if (options?.onlyPending) q = q.eq("status", "pending");
  const { data, error } = await q.order("requested_at", { ascending: false });
  if (error) throw new Error(`listPartnerApprovalRequests: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r): PartnerApprovalRequestRow => ({
    ...rowToApproval(r),
    partnerName: r.supply_partners.name as string,
  }));
}

export type CreatePartnerApprovalInput = {
  organizationId: string;
  partnerId: string;
  sourceKind: PartnerApprovalSourceKind;
  sourceId?: string | null;
  subject: string;
  message?: string;
  advanceNoticeDays: number;
  requestedBy: string | null;
};

export async function createPartnerApprovalRequest(
  input: CreatePartnerApprovalInput,
): Promise<PartnerApprovalRequest> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const dueAt = new Date(Date.now() + input.advanceNoticeDays * 24 * 60 * 60 * 1000).toISOString();
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    partner_id: input.partnerId,
    source_kind: input.sourceKind,
    source_id: input.sourceId ?? null,
    subject: input.subject.trim(),
    requested_by: input.requestedBy,
    due_at: dueAt,
  };
  if (input.message !== undefined) row["message"] = input.message;
  const { data, error } = await admin
    .from("partner_approval_requests")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(`createPartnerApprovalRequest: ${error.message}`);
  return rowToApproval(data);
}

export async function recordPartnerApprovalResponse(input: {
  organizationId: string;
  requestId: string;
  decision: "approved" | "rejected";
  responseNotes?: string;
  recordedBy: string | null;
}): Promise<PartnerApprovalRequest | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = {
    status: input.decision,
    response_at: new Date().toISOString(),
    recorded_by: input.recordedBy,
  };
  if (input.responseNotes !== undefined) patch["response_notes"] = input.responseNotes;
  const { data, error } = await admin
    .from("partner_approval_requests")
    .update(patch)
    .eq("id", input.requestId)
    .eq("organization_id", input.organizationId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`recordPartnerApprovalResponse: ${error.message}`);
  return data ? rowToApproval(data) : null;
}
