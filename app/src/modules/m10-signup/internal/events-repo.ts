// M10 — repo eventi iscrizione + rate-limit check.

import { getAdminClient } from "@/lib/db/admin";
import type { AudienceKind, ConsentChannel, SignupEvent, SignupSourceHint } from "./signup-types";

const SELECT_COLS =
  "id, organization_id, landing_id, contact_id, audience_kind, channels_granted, welcome_voucher_id, source_hint, ip_hash, occurred_at, created_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEvent(row: any): SignupEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    landingId: row.landing_id ?? null,
    contactId: row.contact_id ?? null,
    audienceKind: (row.audience_kind as AudienceKind | null) ?? null,
    channelsGranted: (row.channels_granted ?? []) as ConsentChannel[],
    welcomeVoucherId: row.welcome_voucher_id ?? null,
    sourceHint: row.source_hint as SignupSourceHint,
    ipHash: row.ip_hash ?? null,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

export type EventRow = SignupEvent & {
  landingSlug: string | null;
  landingHeadline: string | null;
  contactFullName: string | null;
  contactEmail: string | null;
};

export async function listSignupEvents(
  organizationId: string,
  limit: number = 100,
): Promise<EventRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("signup_events")
    .select(
      `${SELECT_COLS}, signup_landings(slug, headline), contacts(first_name, last_name, email)`,
    )
    .eq("organization_id", organizationId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Errore lista eventi signup: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row): EventRow => {
    const first = row.contacts?.first_name as string | null | undefined;
    const last = row.contacts?.last_name as string | null | undefined;
    const parts = [first, last].filter((v): v is string => Boolean(v));
    return {
      ...rowToEvent(row),
      landingSlug: (row.signup_landings?.slug as string | null) ?? null,
      landingHeadline: (row.signup_landings?.headline as string | null) ?? null,
      contactFullName: parts.length > 0 ? parts.join(" ") : null,
      contactEmail: (row.contacts?.email as string | null) ?? null,
    };
  });
}

export type InsertEventInput = {
  organizationId: string;
  landingId: string | null;
  contactId: string | null;
  audienceKind?: AudienceKind | null;
  channelsGranted: ConsentChannel[];
  welcomeVoucherId?: string | null;
  sourceHint: SignupSourceHint;
  ipHash?: string | null;
};

export async function insertSignupEvent(input: InsertEventInput): Promise<SignupEvent> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    landing_id: input.landingId,
    contact_id: input.contactId,
    audience_kind: input.audienceKind ?? null,
    channels_granted: input.channelsGranted,
    welcome_voucher_id: input.welcomeVoucherId ?? null,
    source_hint: input.sourceHint,
    ip_hash: input.ipHash ?? null,
  };
  const { data, error } = await admin
    .from("signup_events")
    .insert(row)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`Errore insert evento signup: ${error.message}`);
  return rowToEvent(data);
}

/**
 * Ritorna il conteggio di signup dallo stesso ip_hash negli ultimi N minuti.
 * Usato per rate-limit anti-abuse (soglia consigliata: 3 in 15 min).
 */
export async function countRecentEventsByIp(
  ipHash: string,
  windowMinutes: number,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("signup_events")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("occurred_at", cutoff);
  if (error) throw new Error(`Errore rate-limit: ${error.message}`);
  return count ?? 0;
}

export async function getSignupStats(organizationId: string): Promise<{
  totalEvents: number;
  lastWeek: number;
  vouchersEmitted: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [totalRes, weekRes, voucherRes] = await Promise.all([
    admin
      .from("signup_events")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    admin
      .from("signup_events")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("occurred_at", weekAgo),
    admin
      .from("signup_events")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .not("welcome_voucher_id", "is", null),
  ]);
  if (totalRes.error) throw new Error(`Errore stats total: ${totalRes.error.message}`);
  if (weekRes.error) throw new Error(`Errore stats week: ${weekRes.error.message}`);
  if (voucherRes.error) throw new Error(`Errore stats voucher: ${voucherRes.error.message}`);
  return {
    totalEvents: totalRes.count ?? 0,
    lastWeek: weekRes.count ?? 0,
    vouchersEmitted: voucherRes.count ?? 0,
  };
}
