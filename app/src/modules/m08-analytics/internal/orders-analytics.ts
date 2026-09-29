// M08 — aggregazioni ordini/vendite.

import { getAdminClient } from "@/lib/db/admin";
import type { OrdersAnalytics } from "./analytics-types";
import { PERIOD_DAYS, type AnalyticsPeriod } from "./analytics-types";

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function getOrdersAnalytics(
  organizationId: string,
  period: AnalyticsPeriod,
): Promise<OrdersAnalytics> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const days = PERIOD_DAYS[period];
  const periodStart = daysAgoIso(days);
  const prevPeriodStart = daysAgoIso(days * 2);
  const prevPeriodEnd = daysAgoIso(days);

  const [inPeriodRes, prevRes] = await Promise.all([
    admin
      .from("brand_orders")
      .select("total_cents, channel, status")
      .eq("organization_id", organizationId)
      .gte("placed_at", periodStart),
    admin
      .from("brand_orders")
      .select("total_cents")
      .eq("organization_id", organizationId)
      .gte("placed_at", prevPeriodStart)
      .lt("placed_at", prevPeriodEnd),
  ]);

  if (inPeriodRes.error) throw new Error(`Ordini periodo: ${inPeriodRes.error.message}`);
  if (prevRes.error) throw new Error(`Ordini prec: ${prevRes.error.message}`);

  const rows = (inPeriodRes.data ?? []) as Array<{
    total_cents: number;
    channel: string;
    status: string;
  }>;
  const prevRows = (prevRes.data ?? []) as Array<{ total_cents: number }>;

  const countInPeriod = rows.length;
  const totalCentsInPeriod = rows.reduce((s, r) => s + Number(r.total_cents ?? 0), 0);
  const totalCentsPreviousPeriod = prevRows.reduce((s, r) => s + Number(r.total_cents ?? 0), 0);
  const avgOrderValueCents = countInPeriod > 0 ? Math.round(totalCentsInPeriod / countInPeriod) : 0;

  // By channel
  const channelMap = new Map<string, { count: number; totalCents: number }>();
  for (const r of rows) {
    const prev = channelMap.get(r.channel) ?? { count: 0, totalCents: 0 };
    prev.count++;
    prev.totalCents += Number(r.total_cents ?? 0);
    channelMap.set(r.channel, prev);
  }
  const byChannel = Array.from(channelMap.entries())
    .map(([channel, v]) => ({ channel, count: v.count, totalCents: v.totalCents }))
    .sort((a, b) => b.totalCents - a.totalCents);

  // By status
  const statusMap = new Map<string, number>();
  for (const r of rows) {
    statusMap.set(r.status, (statusMap.get(r.status) ?? 0) + 1);
  }
  const byStatus = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return {
    countInPeriod,
    totalCentsInPeriod,
    totalCentsPreviousPeriod,
    avgOrderValueCents,
    byChannel,
    byStatus,
  };
}
