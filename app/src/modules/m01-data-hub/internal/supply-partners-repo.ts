// M6a · repo fornitori (partner spesa Lenny). RF-6.19.

import { getAdminClient } from "@/lib/db/admin";

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
  archivedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const SELECT_COLS =
  "id, organization_id, name, referent_name, phone, email, category, " +
  "general_consent, general_consent_note, archived_at, notes, created_at, updated_at";

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
