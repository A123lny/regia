// M07 Partners — repo ristoranti.
// Tenant-scoped. Brand filter applicativo: in F1 solo Lenny.

import { getAdminClient } from "@/lib/db/admin";
import type { OnboardingStatus, PartnerRestaurant } from "./partners-types";

const SELECT_COLS =
  "id, organization_id, brand_id, name, referent_name, phone, email, " +
  "address_street, address_city, address_cap, cuisine_category, avg_prep_minutes, " +
  "onboarding_status, cooling_flag, cooling_reason, last_contact_at, notes, " +
  "archived_at, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPartner(row: any): PartnerRestaurant {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    name: row.name,
    referentName: row.referent_name ?? null,
    phone: row.phone ?? null,
    email: row.email ?? null,
    addressStreet: row.address_street ?? null,
    addressCity: row.address_city ?? null,
    addressCap: row.address_cap ?? null,
    cuisineCategory: row.cuisine_category ?? null,
    avgPrepMinutes: row.avg_prep_minutes ?? null,
    onboardingStatus: row.onboarding_status as OnboardingStatus,
    coolingFlag: row.cooling_flag,
    coolingReason: row.cooling_reason ?? null,
    lastContactAt: row.last_contact_at ?? null,
    notes: row.notes ?? null,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ListPartnersInput = {
  organizationId: string;
  brandId: string; // Lenny slug id
  status?: OnboardingStatus;
  coolingOnly?: boolean;
  cuisineCategory?: string;
  query?: string;
  includeArchived?: boolean;
};

export async function listPartners(input: ListPartnersInput): Promise<PartnerRestaurant[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("partner_restaurants")
    .select(SELECT_COLS)
    .eq("organization_id", input.organizationId)
    .eq("brand_id", input.brandId);
  if (!input.includeArchived) q = q.is("archived_at", null);
  if (input.status) q = q.eq("onboarding_status", input.status);
  if (input.coolingOnly) q = q.eq("cooling_flag", true);
  if (input.cuisineCategory) q = q.eq("cuisine_category", input.cuisineCategory);
  if (input.query && input.query.trim().length > 0) {
    const term = `%${input.query.trim()}%`;
    q = q.or(`name.ilike.${term},referent_name.ilike.${term},phone.ilike.${term}`);
  }
  const { data, error } = await q
    .order("cooling_flag", { ascending: false })
    .order("last_contact_at", { ascending: true, nullsFirst: true });
  if (error) throw new Error(`Errore lista partner: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToPartner);
}

export async function getPartner(
  partnerId: string,
  organizationId: string,
): Promise<PartnerRestaurant | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("partner_restaurants")
    .select(SELECT_COLS)
    .eq("id", partnerId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura partner: ${error.message}`);
  return data ? rowToPartner(data) : null;
}

export type UpsertPartnerInput = {
  organizationId: string;
  partnerId?: string;
  brandId: string;
  name: string;
  referentName?: string | null;
  phone?: string | null;
  email?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressCap?: string | null;
  cuisineCategory?: string | null;
  avgPrepMinutes?: number | null;
  onboardingStatus: OnboardingStatus;
  coolingFlag: boolean;
  coolingReason?: string | null;
  notes?: string | null;
};

export async function upsertPartner(input: UpsertPartnerInput): Promise<PartnerRestaurant> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    name: input.name.trim(),
    referent_name: input.referentName ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address_street: input.addressStreet ?? null,
    address_city: input.addressCity ?? null,
    address_cap: input.addressCap ?? null,
    cuisine_category: input.cuisineCategory ?? null,
    avg_prep_minutes: input.avgPrepMinutes ?? null,
    onboarding_status: input.onboardingStatus,
    cooling_flag: input.coolingFlag,
    cooling_reason: input.coolingFlag ? (input.coolingReason ?? null) : null,
    notes: input.notes ?? null,
  };
  if (input.partnerId) {
    const { data, error } = await admin
      .from("partner_restaurants")
      .update(row)
      .eq("id", input.partnerId)
      .eq("organization_id", input.organizationId)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore update partner: ${error.message}`);
    return rowToPartner(data);
  } else {
    const { data, error } = await admin
      .from("partner_restaurants")
      .insert(row)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore insert partner: ${error.message}`);
    return rowToPartner(data);
  }
}

export async function archivePartner(partnerId: string, organizationId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error, count } = await admin
    .from("partner_restaurants")
    .update({ archived_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", partnerId)
    .eq("organization_id", organizationId)
    .is("archived_at", null);
  if (error) throw new Error(`Errore archiviazione partner: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * RF-7.2 "chi contattare questa settimana": partner con last_contact_at > 30gg
 * o mai contattati, escluso usciti/archived.
 */
export async function getPartnerStats(
  organizationId: string,
  brandId: string,
): Promise<{
  total: number;
  attivi: number;
  inRaffreddamento: number;
  daContattare: number;
  maiPartiti: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [totalRes, attiviRes, coolingRes, maiPartitiRes] = await Promise.all([
    admin
      .from("partner_restaurants")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("brand_id", brandId)
      .is("archived_at", null),
    admin
      .from("partner_restaurants")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("brand_id", brandId)
      .eq("onboarding_status", "attivo")
      .is("archived_at", null),
    admin
      .from("partner_restaurants")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("brand_id", brandId)
      .eq("cooling_flag", true)
      .is("archived_at", null),
    admin
      .from("partner_restaurants")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("brand_id", brandId)
      .eq("onboarding_status", "mai_partito")
      .is("archived_at", null),
  ]);

  // "Da contattare": last_contact_at null OR last_contact_at < 30gg fa, escluso uscito
  const daContattareRes = await admin
    .from("partner_restaurants")
    .select("id, last_contact_at, onboarding_status")
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .neq("onboarding_status", "uscito")
    .is("archived_at", null);
  if (daContattareRes.error) {
    throw new Error(`Errore da contattare: ${daContattareRes.error.message}`);
  }
  const daContattare = (
    (daContattareRes.data ?? []) as Array<{
      last_contact_at: string | null;
    }>
  ).filter((r) => !r.last_contact_at || r.last_contact_at < cutoffIso).length;

  if (totalRes.error) throw new Error(`Errore stats total: ${totalRes.error.message}`);
  if (attiviRes.error) throw new Error(`Errore stats attivi: ${attiviRes.error.message}`);
  if (coolingRes.error) throw new Error(`Errore stats cooling: ${coolingRes.error.message}`);
  if (maiPartitiRes.error)
    throw new Error(`Errore stats mai partiti: ${maiPartitiRes.error.message}`);

  return {
    total: totalRes.count ?? 0,
    attivi: attiviRes.count ?? 0,
    inRaffreddamento: coolingRes.count ?? 0,
    daContattare,
    maiPartiti: maiPartitiRes.count ?? 0,
  };
}
