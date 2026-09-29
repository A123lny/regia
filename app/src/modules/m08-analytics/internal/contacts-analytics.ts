// M08 — aggregazioni contatti.

import { getAdminClient } from "@/lib/db/admin";
import type { ContactsAnalytics } from "./analytics-types";
import { PERIOD_DAYS, type AnalyticsPeriod } from "./analytics-types";

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function getContactsAnalytics(
  organizationId: string,
  period: AnalyticsPeriod,
): Promise<ContactsAnalytics> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const days = PERIOD_DAYS[period];
  const periodStart = daysAgoIso(days);
  const prevPeriodStart = daysAgoIso(days * 2);
  const prevPeriodEnd = daysAgoIso(days);

  const [totalActiveRes, totalArchivedRes, newRes, prevRes, allContactsRes, consentsRes] =
    await Promise.all([
      admin
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .is("archived_at", null),
      admin
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .not("archived_at", "is", null),
      admin
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", periodStart),
      admin
        .from("contacts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", prevPeriodStart)
        .lt("created_at", prevPeriodEnd),
      admin
        .from("contacts")
        .select("source")
        .eq("organization_id", organizationId)
        .is("archived_at", null),
      admin
        .from("contact_consents")
        .select("channel, status")
        .eq("organization_id", organizationId),
    ]);

  if (totalActiveRes.error) throw new Error(`Contatti attivi: ${totalActiveRes.error.message}`);
  if (totalArchivedRes.error)
    throw new Error(`Contatti archiviati: ${totalArchivedRes.error.message}`);
  if (newRes.error) throw new Error(`Nuovi contatti: ${newRes.error.message}`);
  if (prevRes.error) throw new Error(`Nuovi periodo prec: ${prevRes.error.message}`);
  if (allContactsRes.error) throw new Error(`Sources: ${allContactsRes.error.message}`);
  if (consentsRes.error) throw new Error(`Consensi: ${consentsRes.error.message}`);

  // Aggregazione per source
  const sourceMap = new Map<string, number>();
  for (const r of (allContactsRes.data ?? []) as Array<{ source: string }>) {
    sourceMap.set(r.source, (sourceMap.get(r.source) ?? 0) + 1);
  }
  const bySource = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // Aggregazione consensi per canale
  const consentMap = new Map<string, { granted: number; revoked: number; never: number }>();
  for (const r of (consentsRes.data ?? []) as Array<{ channel: string; status: string }>) {
    const prev = consentMap.get(r.channel) ?? { granted: 0, revoked: 0, never: 0 };
    if (r.status === "granted") prev.granted++;
    else if (r.status === "revoked") prev.revoked++;
    else prev.never++;
    consentMap.set(r.channel, prev);
  }
  const consentsByChannel = ["email", "sms", "whatsapp"].map((channel) => ({
    channel,
    granted: consentMap.get(channel)?.granted ?? 0,
    revoked: consentMap.get(channel)?.revoked ?? 0,
    never: consentMap.get(channel)?.never ?? 0,
  }));

  return {
    totalActive: totalActiveRes.count ?? 0,
    totalArchived: totalArchivedRes.count ?? 0,
    newInPeriod: newRes.count ?? 0,
    newPreviousPeriod: prevRes.count ?? 0,
    bySource,
    consentsByChannel,
  };
}
