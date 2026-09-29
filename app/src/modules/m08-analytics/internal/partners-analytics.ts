// M08 — aggregazioni rete ristoranti.

import { getAdminClient } from "@/lib/db/admin";
import type { PartnersAnalytics } from "./analytics-types";

export async function getPartnersAnalytics(organizationId: string): Promise<PartnersAnalytics> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  const { data, error } = await admin
    .from("partner_restaurants")
    .select("onboarding_status, cooling_flag, last_contact_at")
    .eq("organization_id", organizationId)
    .is("archived_at", null);
  if (error) throw new Error(`Partners: ${error.message}`);

  const rows = (data ?? []) as Array<{
    onboarding_status: string;
    cooling_flag: boolean;
    last_contact_at: string | null;
  }>;

  const statusMap = new Map<string, number>();
  let cooling = 0;
  let totalActive = 0;
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let toContact = 0;

  for (const r of rows) {
    statusMap.set(r.onboarding_status, (statusMap.get(r.onboarding_status) ?? 0) + 1);
    if (r.cooling_flag) cooling++;
    if (r.onboarding_status === "attivo") totalActive++;
    if (r.onboarding_status !== "uscito") {
      if (!r.last_contact_at || r.last_contact_at < cutoff) toContact++;
    }
  }

  const byStatus = Array.from(statusMap.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  return {
    byStatus,
    cooling,
    toContact,
    totalActive,
  };
}
