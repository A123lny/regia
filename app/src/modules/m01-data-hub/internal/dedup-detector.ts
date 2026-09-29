// RF-1.7 · rilevatore contatti duplicati.
// Aggrega su email/phone/whatsapp normalizzati. In F1 nessuna fuzzy Levenshtein sui nomi
// (troppi falsi positivi per volumi piccoli, meglio matching solido su recapito univoco).

import { getAdminClient } from "@/lib/db/admin";

export type DuplicateMatchKind = "email" | "phone" | "whatsapp";

export type ContactSummary = {
  id: string;
  brandId: string;
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  source: string;
  tagsCount: number;
  createdAt: string;
  // ricchezza dati (per suggerire chi tenere)
  hasVehicles: boolean;
  ordersCount: number;
  vouchersCount: number;
};

export type DuplicateGroup = {
  matchKind: DuplicateMatchKind;
  matchValue: string;
  contacts: ContactSummary[];
};

function normalizeEmail(e: string | null): string | null {
  if (!e) return null;
  const trimmed = e.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePhone(p: string | null): string | null {
  if (!p) return null;
  const cleaned = p.replace(/[\s+\-()]/g, "").trim();
  return cleaned.length >= 6 ? cleaned : null;
}

/**
 * Trova gruppi di contatti duplicati nell'organizzazione.
 * Un gruppo = 2+ contatti che condividono lo stesso recapito normalizzato.
 * Uno stesso contatto può apparire in più gruppi (email + telefono match diversi).
 */
export async function findDuplicateGroups(organizationId: string): Promise<DuplicateGroup[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  const { data, error } = await admin
    .from("contacts")
    .select(
      "id, brand_id, first_name, last_name, email, phone, whatsapp, source, tags, created_at, brands!inner(slug, display_name, color, is_archived)",
    )
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .eq("brands.is_archived", false)
    .is("is_duplicate_of", null); // escludi già marcati come duplicati
  if (error) throw new Error(`Errore fetch contatti: ${error.message}`);

  const rows = (data ?? []) as Array<{
    id: string;
    brand_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    source: string;
    tags: string[] | null;
    created_at: string;
    brands: { slug: string; display_name: string; color: string };
  }>;

  // Fetch aggregati per ricchezza dati (ordini, voucher, veicoli)
  const contactIds = rows.map((r) => r.id);
  if (contactIds.length === 0) return [];

  const [ordersAgg, vouchersAgg, vehiclesAgg] = await Promise.all([
    admin
      .from("brand_orders")
      .select("contact_id")
      .eq("organization_id", organizationId)
      .in("contact_id", contactIds),
    admin
      .from("vouchers")
      .select("contact_id")
      .eq("organization_id", organizationId)
      .in("contact_id", contactIds),
    admin
      .from("contact_vehicles")
      .select("contact_id")
      .eq("organization_id", organizationId)
      .in("contact_id", contactIds),
  ]);

  const ordersMap = new Map<string, number>();
  for (const r of (ordersAgg.data ?? []) as Array<{ contact_id: string }>) {
    ordersMap.set(r.contact_id, (ordersMap.get(r.contact_id) ?? 0) + 1);
  }
  const vouchersMap = new Map<string, number>();
  for (const r of (vouchersAgg.data ?? []) as Array<{ contact_id: string }>) {
    vouchersMap.set(r.contact_id, (vouchersMap.get(r.contact_id) ?? 0) + 1);
  }
  const vehiclesSet = new Set<string>();
  for (const r of (vehiclesAgg.data ?? []) as Array<{ contact_id: string }>) {
    vehiclesSet.add(r.contact_id);
  }

  function toSummary(r: (typeof rows)[number]): ContactSummary {
    return {
      id: r.id,
      brandId: r.brand_id,
      brandSlug: r.brands.slug,
      brandDisplayName: r.brands.display_name,
      brandColor: r.brands.color,
      firstName: r.first_name,
      lastName: r.last_name,
      email: r.email,
      phone: r.phone,
      whatsapp: r.whatsapp,
      source: r.source,
      tagsCount: (r.tags ?? []).length,
      createdAt: r.created_at,
      hasVehicles: vehiclesSet.has(r.id),
      ordersCount: ordersMap.get(r.id) ?? 0,
      vouchersCount: vouchersMap.get(r.id) ?? 0,
    };
  }

  // Aggrega per (kind, valore normalizzato)
  const emailGroups = new Map<string, ContactSummary[]>();
  const phoneGroups = new Map<string, ContactSummary[]>();
  const whatsappGroups = new Map<string, ContactSummary[]>();

  for (const r of rows) {
    const summary = toSummary(r);
    const e = normalizeEmail(r.email);
    const p = normalizePhone(r.phone);
    const w = normalizePhone(r.whatsapp);
    if (e) {
      const list = emailGroups.get(e) ?? [];
      list.push(summary);
      emailGroups.set(e, list);
    }
    if (p) {
      const list = phoneGroups.get(p) ?? [];
      list.push(summary);
      phoneGroups.set(p, list);
    }
    if (w) {
      const list = whatsappGroups.get(w) ?? [];
      list.push(summary);
      whatsappGroups.set(w, list);
    }
  }

  const result: DuplicateGroup[] = [];
  for (const [value, contacts] of emailGroups.entries()) {
    if (contacts.length >= 2) {
      result.push({ matchKind: "email", matchValue: value, contacts });
    }
  }
  for (const [value, contacts] of phoneGroups.entries()) {
    if (contacts.length >= 2) {
      result.push({ matchKind: "phone", matchValue: value, contacts });
    }
  }
  for (const [value, contacts] of whatsappGroups.entries()) {
    if (contacts.length >= 2) {
      result.push({ matchKind: "whatsapp", matchValue: value, contacts });
    }
  }

  return result;
}
