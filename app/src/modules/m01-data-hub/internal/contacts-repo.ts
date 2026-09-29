// M01 Data Hub — repo contatti (RS-2 via getAdminClient).
// Tenant-scoped su organization_id (RN-87) su tutte le query esposte.

import { getAdminClient } from "@/lib/db/admin";
import type { Contact, ContactSource, ConsentChannel, ConsentStatus } from "./contacts-types";

const SELECT_COLS =
  "id, organization_id, brand_id, first_name, last_name, email, phone, whatsapp, " +
  "address_street, address_city, address_cap, tags, notes, source, " +
  "is_duplicate_of, archived_at, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToContact(row: any): Contact {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    firstName: row.first_name ?? null,
    lastName: row.last_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    whatsapp: row.whatsapp ?? null,
    addressStreet: row.address_street ?? null,
    addressCity: row.address_city ?? null,
    addressCap: row.address_cap ?? null,
    tags: (row.tags ?? []) as string[],
    notes: row.notes ?? null,
    source: row.source as ContactSource,
    isDuplicateOf: row.is_duplicate_of ?? null,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ListContactsInput = {
  organizationId: string;
  brandId?: string;
  source?: ContactSource;
  query?: string; // ricerca testo su nome/email/phone
  consentChannel?: ConsentChannel; // se set con consentStatus filtra su consensi
  consentStatus?: ConsentStatus;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
};

export type ListContactsResult = {
  items: Array<Contact & { brandSlug: string; brandDisplayName: string; brandColor: string }>;
  totalCount: number;
};

/**
 * Lista contatti cross-brand. Include chip brand per la UI.
 * Filtro consenso: se consentChannel+consentStatus sono entrambi presenti, ritorna
 * solo i contatti con quel consenso specifico.
 */
export async function listContacts(input: ListContactsInput): Promise<ListContactsResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  // Se filtriamo per consenso: prima query su contact_consents per ottenere contact_id
  // matching, poi filtro sui contatti. Con volumi piccoli va bene.
  let contactIdsFilter: string[] | null = null;
  if (input.consentChannel && input.consentStatus) {
    const { data, error } = await admin
      .from("contact_consents")
      .select("contact_id")
      .eq("organization_id", input.organizationId)
      .eq("channel", input.consentChannel)
      .eq("status", input.consentStatus);
    if (error) throw new Error(`Errore filtro consensi: ${error.message}`);
    contactIdsFilter = ((data ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id);
    if (contactIdsFilter.length === 0) {
      return { items: [], totalCount: 0 };
    }
  }

  let q = admin
    .from("contacts")
    .select(`${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived)`, {
      count: "exact",
    })
    .eq("organization_id", input.organizationId)
    .eq("brands.is_archived", false);

  if (!input.includeArchived) q = q.is("archived_at", null);
  if (input.brandId) q = q.eq("brand_id", input.brandId);
  if (input.source) q = q.eq("source", input.source);
  if (contactIdsFilter) q = q.in("id", contactIdsFilter);

  if (input.query && input.query.trim().length > 0) {
    const term = `%${input.query.trim()}%`;
    q = q.or(
      `first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`,
    );
  }

  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  q = q.order("created_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) throw new Error(`Errore lista contatti: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = ((data ?? []) as any[]).map((row) => ({
    ...rowToContact(row),
    brandSlug: row.brands.slug as string,
    brandDisplayName: row.brands.display_name as string,
    brandColor: row.brands.color as string,
  }));
  return { items, totalCount: count ?? items.length };
}

/**
 * Get singolo contatto tenant-scoped. Ritorna null se non appartiene all'org (IDOR blocker).
 */
export async function getContact(
  contactId: string,
  organizationId: string,
): Promise<Contact | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("contacts")
    .select(SELECT_COLS)
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura contatto: ${error.message}`);
  return data ? rowToContact(data) : null;
}

export type CreateContactInput = {
  organizationId: string;
  brandId: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressCap?: string | null;
  tags?: string[];
  notes?: string | null;
  source: ContactSource;
};

export async function createContact(input: CreateContactInput): Promise<Contact> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const insertRow: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    first_name: input.firstName ?? null,
    last_name: input.lastName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    address_street: input.addressStreet ?? null,
    address_city: input.addressCity ?? null,
    address_cap: input.addressCap ?? null,
    tags: input.tags ?? [],
    notes: input.notes ?? null,
    source: input.source,
  };
  const { data, error } = await admin
    .from("contacts")
    .insert(insertRow)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`Errore creazione contatto: ${error.message}`);
  return rowToContact(data);
}

export type UpdateContactInput = {
  contactId: string;
  organizationId: string;
  patch: Partial<
    Pick<
      CreateContactInput,
      | "firstName"
      | "lastName"
      | "email"
      | "phone"
      | "whatsapp"
      | "addressStreet"
      | "addressCity"
      | "addressCap"
      | "tags"
      | "notes"
    >
  >;
};

export async function updateContact(input: UpdateContactInput): Promise<Contact | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = {};
  if (input.patch.firstName !== undefined) patch["first_name"] = input.patch.firstName;
  if (input.patch.lastName !== undefined) patch["last_name"] = input.patch.lastName;
  if (input.patch.email !== undefined) patch["email"] = input.patch.email;
  if (input.patch.phone !== undefined) patch["phone"] = input.patch.phone;
  if (input.patch.whatsapp !== undefined) patch["whatsapp"] = input.patch.whatsapp;
  if (input.patch.addressStreet !== undefined) patch["address_street"] = input.patch.addressStreet;
  if (input.patch.addressCity !== undefined) patch["address_city"] = input.patch.addressCity;
  if (input.patch.addressCap !== undefined) patch["address_cap"] = input.patch.addressCap;
  if (input.patch.tags !== undefined) patch["tags"] = input.patch.tags;
  if (input.patch.notes !== undefined) patch["notes"] = input.patch.notes;

  if (Object.keys(patch).length === 0) {
    return getContact(input.contactId, input.organizationId);
  }

  const { data, error } = await admin
    .from("contacts")
    .update(patch)
    .eq("id", input.contactId)
    .eq("organization_id", input.organizationId)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore aggiornamento contatto: ${error.message}`);
  return data ? rowToContact(data) : null;
}

/**
 * Soft-delete: set archived_at. Preservazione storico (RF-11.3 audit trail).
 */
export async function archiveContact(contactId: string, organizationId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error, count } = await admin
    .from("contacts")
    .update({ archived_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .is("archived_at", null);
  if (error) throw new Error(`Errore archiviazione contatto: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function restoreContact(contactId: string, organizationId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error, count } = await admin
    .from("contacts")
    .update({ archived_at: null }, { count: "exact" })
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .not("archived_at", "is", null);
  if (error) throw new Error(`Errore ripristino contatto: ${error.message}`);
  return (count ?? 0) > 0;
}

/**
 * Contatori di riepilogo per header pagina.
 */
export async function getContactsStats(organizationId: string): Promise<{
  total: number;
  withEmailConsent: number;
  withPhoneConsent: number;
  withWhatsappConsent: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const [totalRes, emailRes, phoneRes, wappRes] = await Promise.all([
    admin
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("archived_at", null),
    admin
      .from("contact_consents")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("channel", "email")
      .eq("status", "granted"),
    admin
      .from("contact_consents")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("channel", "sms")
      .eq("status", "granted"),
    admin
      .from("contact_consents")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("channel", "whatsapp")
      .eq("status", "granted"),
  ]);
  if (totalRes.error) throw new Error(`Errore conteggio contatti: ${totalRes.error.message}`);
  if (emailRes.error) throw new Error(`Errore conteggio email: ${emailRes.error.message}`);
  if (phoneRes.error) throw new Error(`Errore conteggio sms: ${phoneRes.error.message}`);
  if (wappRes.error) throw new Error(`Errore conteggio whatsapp: ${wappRes.error.message}`);
  return {
    total: totalRes.count ?? 0,
    withEmailConsent: emailRes.count ?? 0,
    withPhoneConsent: phoneRes.count ?? 0,
    withWhatsappConsent: wappRes.count ?? 0,
  };
}
