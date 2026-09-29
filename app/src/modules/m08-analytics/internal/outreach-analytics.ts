// M08 — aggregazioni segmenti + campagne.

import { getAdminClient } from "@/lib/db/admin";
import type { OutreachAnalytics } from "./analytics-types";

export async function getOutreachAnalytics(organizationId: string): Promise<OutreachAnalytics> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  const [segRes, draftRes, schedRes, sentRes, lastSentRes] = await Promise.all([
    admin
      .from("contact_segments")
      .select("contact_count_materialized")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
    admin
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "draft"),
    admin
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "scheduled"),
    admin
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "sent"),
    admin
      .from("campaigns")
      .select("name, channel, attempted_count, delivered_count, failed_count, sent_at")
      .eq("organization_id", organizationId)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (segRes.error) throw new Error(`Segments: ${segRes.error.message}`);
  if (draftRes.error) throw new Error(`Draft: ${draftRes.error.message}`);
  if (schedRes.error) throw new Error(`Scheduled: ${schedRes.error.message}`);
  if (sentRes.error) throw new Error(`Sent: ${sentRes.error.message}`);
  if (lastSentRes.error) throw new Error(`LastSent: ${lastSentRes.error.message}`);

  const segRows = (segRes.data ?? []) as Array<{ contact_count_materialized: number }>;
  const totalSegmentedContacts = segRows.reduce(
    (s, r) => s + Number(r.contact_count_materialized ?? 0),
    0,
  );

  return {
    activeSegments: segRows.length,
    totalSegmentedContacts,
    campaignsDraft: draftRes.count ?? 0,
    campaignsScheduled: schedRes.count ?? 0,
    campaignsSent: sentRes.count ?? 0,
    lastCampaignSent: lastSentRes.data
      ? {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name: (lastSentRes.data as any).name as string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          channel: (lastSentRes.data as any).channel as string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          attempted: (lastSentRes.data as any).attempted_count as number,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delivered: (lastSentRes.data as any).delivered_count as number,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          failed: (lastSentRes.data as any).failed_count as number,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sentAt: (lastSentRes.data as any).sent_at as string,
        }
      : null,
  };
}
