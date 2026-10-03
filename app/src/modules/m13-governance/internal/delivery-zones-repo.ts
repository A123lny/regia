// RN-52 Zone di consegna variabili + guard.
// RF-5.5a + vincolo assoluto: mai inviare promozioni a zone non servite.

import { getAdminClient } from "@/lib/db/admin";

export type DeliveryBlackoutKind = "snow" | "rain" | "event" | "road_closure" | "other";

export const BLACKOUT_KIND_LABELS: Record<DeliveryBlackoutKind, string> = {
  snow: "Neve",
  rain: "Pioggia (capacita' ridotta)",
  event: "Evento locale",
  road_closure: "Chiusura stradale",
  other: "Altro",
};

export type DeliveryZone = {
  id: string;
  organizationId: string;
  brandId: string;
  name: string;
  description: string | null;
  capPrefixes: string[];
  updatedAt: string;
};

export type DeliveryZoneRow = DeliveryZone & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  activeBlackout: ActiveBlackout | null;
};

export type ActiveBlackout = {
  id: string;
  kind: DeliveryBlackoutKind;
  reason: string | null;
  startAt: string;
  endAt: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToZone(row: any): DeliveryZone {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    name: row.name,
    description: row.description ?? null,
    capPrefixes: (row.cap_prefixes ?? []) as string[],
    updatedAt: row.updated_at,
  };
}

export async function listDeliveryZones(organizationId: string): Promise<DeliveryZoneRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: zones, error } = await admin
    .from("delivery_zones")
    .select("*, brands!inner(slug, display_name, color)")
    .eq("organization_id", organizationId)
    .order("brand_id")
    .order("name");
  if (error) throw new Error(`listDeliveryZones: ${error.message}`);

  // Carica blackout attivi
  const nowIso = new Date().toISOString();
  const { data: blackouts } = await admin
    .from("delivery_zone_blackouts")
    .select("id, zone_id, kind, reason, start_at, end_at")
    .eq("organization_id", organizationId)
    .is("closed_at", null)
    .or(`end_at.is.null,end_at.gt.${nowIso}`);
  const activeByZone = new Map<string, ActiveBlackout>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const b of (blackouts ?? []) as any[]) {
    activeByZone.set(b.zone_id as string, {
      id: b.id as string,
      kind: b.kind as DeliveryBlackoutKind,
      reason: (b.reason as string | null) ?? null,
      startAt: b.start_at as string,
      endAt: (b.end_at as string | null) ?? null,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((zones ?? []) as any[]).map((r): DeliveryZoneRow => ({
    ...rowToZone(r),
    brandSlug: r.brands.slug as string,
    brandDisplayName: r.brands.display_name as string,
    brandColor: r.brands.color as string,
    activeBlackout: activeByZone.get(r.id as string) ?? null,
  }));
}

export type UpsertZoneInput = {
  organizationId: string;
  brandId: string;
  zoneId?: string;
  name: string;
  description?: string | null;
  capPrefixes: string[];
};

export async function upsertDeliveryZone(input: UpsertZoneInput): Promise<DeliveryZone> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    name: input.name.trim(),
    description: input.description ?? null,
    cap_prefixes: input.capPrefixes.map((p) => p.trim()).filter((p) => p.length > 0),
    updated_at: new Date().toISOString(),
  };
  if (input.zoneId) {
    const { data, error } = await admin
      .from("delivery_zones")
      .update(row)
      .eq("id", input.zoneId)
      .eq("organization_id", input.organizationId)
      .select("*")
      .single();
    if (error) throw new Error(`upsertDeliveryZone update: ${error.message}`);
    return rowToZone(data);
  }
  const { data, error } = await admin.from("delivery_zones").insert(row).select("*").single();
  if (error) throw new Error(`upsertDeliveryZone insert: ${error.message}`);
  return rowToZone(data);
}

export async function deleteDeliveryZone(organizationId: string, zoneId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("delivery_zones")
    .delete()
    .eq("id", zoneId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(`deleteDeliveryZone: ${error.message}`);
}

// ============================================================================
// Blackouts
// ============================================================================

export type OpenBlackoutInput = {
  organizationId: string;
  zoneId: string;
  kind: DeliveryBlackoutKind;
  reason?: string;
  endAt?: string | null; // ISO datetime, null = indefinito (chiusura manuale)
  triggeredBy: string | null;
};

export async function openBlackout(input: OpenBlackoutInput): Promise<ActiveBlackout> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    zone_id: input.zoneId,
    kind: input.kind,
    triggered_by: input.triggeredBy,
  };
  if (input.reason !== undefined) row["reason"] = input.reason;
  if (input.endAt !== undefined) row["end_at"] = input.endAt;
  const { data, error } = await admin
    .from("delivery_zone_blackouts")
    .insert(row)
    .select("id, kind, reason, start_at, end_at")
    .single();
  if (error) throw new Error(`openBlackout: ${error.message}`);
  return {
    id: data.id as string,
    kind: data.kind as DeliveryBlackoutKind,
    reason: (data.reason as string | null) ?? null,
    startAt: data.start_at as string,
    endAt: (data.end_at as string | null) ?? null,
  };
}

export async function closeBlackout(
  organizationId: string,
  blackoutId: string,
  closedBy: string | null,
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("delivery_zone_blackouts")
    .update({ closed_at: new Date().toISOString(), closed_by: closedBy })
    .eq("id", blackoutId)
    .eq("organization_id", organizationId)
    .is("closed_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`closeBlackout: ${error.message}`);
  return !!data;
}

// ============================================================================
// GUARD (RN-52 vincolo assoluto)
// ============================================================================

export class DeliveryZoneBlackoutError extends Error {
  constructor(
    public details: {
      contactId: string;
      zoneName: string;
      kind: DeliveryBlackoutKind;
      since: string;
    },
  ) {
    super(
      `RN-52: contatto ${details.contactId} abita in zona "${details.zoneName}" in blackout (${details.kind}) dal ${details.since}. Nessuna promo food puo' partire.`,
    );
    this.name = "DeliveryZoneBlackoutError";
  }
}

export type BlackoutCheck =
  | { inBlackout: false }
  | {
      inBlackout: true;
      zoneId: string;
      zoneName: string;
      kind: DeliveryBlackoutKind;
      reason: string | null;
      since: string;
      endAt: string | null;
    };

/**
 * RN-52 vincolo assoluto: controlla se il contatto abita in una zona
 * attualmente in blackout. Match su contacts.address_cap vs
 * delivery_zones.cap_prefixes (prefix match, es. CAP "47892" matcha prefisso "4789").
 *
 * Ritorna { inBlackout: false } se:
 * - il contatto non ha address_cap
 * - nessuna zona copre il suo CAP
 * - la zona non ha blackout attivi
 *
 * Il motore promo chiama questa guard PRIMA di accodare l'invio promozionale
 * food. Se inBlackout=true, non accoda e logga (il chiamante decide se
 * posticipare, cancellare, o chiedere all'Owner).
 */
export async function isContactInBlackoutZone(
  organizationId: string,
  contactId: string,
): Promise<BlackoutCheck> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  // Carica contact.address_cap + brand_id (per filtrare zone del suo brand)
  const { data: c, error: cErr } = await admin
    .from("contacts")
    .select("address_cap, brand_id")
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle();
  if (cErr) throw new Error(`isContactInBlackoutZone contact: ${cErr.message}`);
  if (!c || !c.address_cap) return { inBlackout: false };

  const contactCap = String(c.address_cap).trim();
  if (contactCap.length === 0) return { inBlackout: false };

  // Carica zone del brand del contatto che hanno un prefisso che matcha il CAP.
  // Postgres array `@>` o unnest + startsWith: usiamo filter array overlap su cap_prefixes
  // trasformando: una zona matcha se qualche prefisso e' startsWith del CAP.
  // Semplice: carichiamo tutte le zone del brand e filtriamo in JS (volumi piccoli).
  const { data: zones } = await admin
    .from("delivery_zones")
    .select("id, name, cap_prefixes")
    .eq("organization_id", organizationId)
    .eq("brand_id", c.brand_id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchingZone = ((zones ?? []) as any[]).find((z) => {
    const prefixes = (z.cap_prefixes ?? []) as string[];
    return prefixes.some((p) => contactCap.startsWith(p));
  });
  if (!matchingZone) return { inBlackout: false };

  // Controllo blackout attivi su quella zona
  const nowIso = new Date().toISOString();
  const { data: active } = await admin
    .from("delivery_zone_blackouts")
    .select("kind, reason, start_at, end_at")
    .eq("organization_id", organizationId)
    .eq("zone_id", matchingZone.id)
    .is("closed_at", null)
    .or(`end_at.is.null,end_at.gt.${nowIso}`)
    .order("start_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!active) return { inBlackout: false };

  return {
    inBlackout: true,
    zoneId: matchingZone.id as string,
    zoneName: matchingZone.name as string,
    kind: active.kind as DeliveryBlackoutKind,
    reason: (active.reason as string | null) ?? null,
    since: active.start_at as string,
    endAt: (active.end_at as string | null) ?? null,
  };
}

/**
 * Variante throw: usabile come guardia "codice dispone" nel motore promo.
 */
export async function assertDeliveryZonesOk(
  organizationId: string,
  contactId: string,
): Promise<void> {
  const check = await isContactInBlackoutZone(organizationId, contactId);
  if (check.inBlackout) {
    throw new DeliveryZoneBlackoutError({
      contactId,
      zoneName: check.zoneName,
      kind: check.kind,
      since: check.since,
    });
  }
}
