// M08 — aggregazioni signup + conversione voucher per landing.

import { getAdminClient } from "@/lib/db/admin";
import type { SignupAnalytics } from "./analytics-types";
import { PERIOD_DAYS, type AnalyticsPeriod } from "./analytics-types";

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function getSignupAnalytics(
  organizationId: string,
  period: AnalyticsPeriod,
): Promise<SignupAnalytics> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const days = PERIOD_DAYS[period];
  const periodStart = daysAgoIso(days);
  const prevPeriodStart = daysAgoIso(days * 2);
  const prevPeriodEnd = daysAgoIso(days);

  const [eventsRes, prevRes, landingsRes] = await Promise.all([
    admin
      .from("signup_events")
      .select("landing_id, welcome_voucher_id")
      .eq("organization_id", organizationId)
      .gte("occurred_at", periodStart),
    admin
      .from("signup_events")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("occurred_at", prevPeriodStart)
      .lt("occurred_at", prevPeriodEnd),
    admin
      .from("signup_landings")
      .select("id, slug, headline")
      .eq("organization_id", organizationId),
  ]);

  if (eventsRes.error) throw new Error(`Events: ${eventsRes.error.message}`);
  if (prevRes.error) throw new Error(`Prev: ${prevRes.error.message}`);
  if (landingsRes.error) throw new Error(`Landings: ${landingsRes.error.message}`);

  const events = (eventsRes.data ?? []) as Array<{
    landing_id: string | null;
    welcome_voucher_id: string | null;
  }>;

  const totalEventsInPeriod = events.length;
  const vouchersEmitted = events.filter((e) => e.welcome_voucher_id !== null).length;

  // Aggregate per landing
  const perLanding = new Map<string, { signups: number; vouchers: number }>();
  for (const e of events) {
    if (!e.landing_id) continue;
    const prev = perLanding.get(e.landing_id) ?? { signups: 0, vouchers: 0 };
    prev.signups++;
    if (e.welcome_voucher_id) prev.vouchers++;
    perLanding.set(e.landing_id, prev);
  }

  const landingsById = new Map<string, { slug: string; headline: string }>();
  for (const l of (landingsRes.data ?? []) as Array<{
    id: string;
    slug: string;
    headline: string;
  }>) {
    landingsById.set(l.id, { slug: l.slug, headline: l.headline });
  }

  const byLanding = Array.from(perLanding.entries())
    .map(([landingId, v]) => {
      const l = landingsById.get(landingId);
      const slug = l?.slug ?? "sconosciuta";
      const headline = l?.headline ?? "";
      const conversionPct = v.signups > 0 ? Math.round((v.vouchers / v.signups) * 100) : 0;
      return {
        slug,
        headline,
        signups: v.signups,
        vouchersEmitted: v.vouchers,
        conversionPct,
      };
    })
    .sort((a, b) => b.signups - a.signups);

  return {
    totalEventsInPeriod,
    totalEventsPreviousPeriod: prevRes.count ?? 0,
    vouchersEmitted,
    byLanding,
  };
}
