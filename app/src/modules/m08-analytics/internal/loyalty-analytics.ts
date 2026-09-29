// M08 — aggregazioni fedeltà + voucher + top progressi.

import { getAdminClient } from "@/lib/db/admin";
import type { LoyaltyAnalytics } from "./analytics-types";

export async function getLoyaltyAnalytics(organizationId: string): Promise<LoyaltyAnalytics> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const now = new Date().toISOString();
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [activeRes, redeemedRes, totalRes, expiringRes, eventsRes, countersRes, contactsRes] =
    await Promise.all([
      admin
        .from("vouchers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "issued")
        .gt("expires_at", now),
      admin
        .from("vouchers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "redeemed"),
      admin
        .from("vouchers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId),
      admin
        .from("vouchers")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "issued")
        .gt("expires_at", now)
        .lt("expires_at", in7),
      // Eventi contatore aggregati per (counter, contact)
      admin
        .from("loyalty_counter_events")
        .select("counter_id, contact_id, delta_count, delta_value_cents")
        .eq("organization_id", organizationId),
      admin
        .from("loyalty_counters")
        .select("id, name, kind, threshold_count, threshold_value_cents")
        .eq("organization_id", organizationId)
        .eq("is_active", true),
      admin
        .from("contacts")
        .select("id, first_name, last_name")
        .eq("organization_id", organizationId)
        .is("archived_at", null),
    ]);

  if (activeRes.error) throw new Error(`Voucher active: ${activeRes.error.message}`);
  if (redeemedRes.error) throw new Error(`Redeemed: ${redeemedRes.error.message}`);
  if (totalRes.error) throw new Error(`Total: ${totalRes.error.message}`);
  if (expiringRes.error) throw new Error(`Expiring: ${expiringRes.error.message}`);
  if (eventsRes.error) throw new Error(`Events: ${eventsRes.error.message}`);
  if (countersRes.error) throw new Error(`Counters: ${countersRes.error.message}`);
  if (contactsRes.error) throw new Error(`Contacts: ${contactsRes.error.message}`);

  const totalIssued = totalRes.count ?? 0;
  const redeemed = redeemedRes.count ?? 0;
  const redemptionRatePct = totalIssued > 0 ? Math.round((redeemed / totalIssued) * 100) : 0;

  // Aggregate progress per (counter, contact)
  const events = (eventsRes.data ?? []) as Array<{
    counter_id: string;
    contact_id: string;
    delta_count: number;
    delta_value_cents: number;
  }>;
  const progressMap = new Map<string, { count: number; valueCents: number }>();
  for (const e of events) {
    const key = `${e.counter_id}|${e.contact_id}`;
    const prev = progressMap.get(key) ?? { count: 0, valueCents: 0 };
    prev.count += Number(e.delta_count ?? 0);
    prev.valueCents += Number(e.delta_value_cents ?? 0);
    progressMap.set(key, prev);
  }

  // Counters lookup + contatti lookup
  const countersById = new Map<
    string,
    {
      name: string;
      kind: string;
      thresholdCount: number | null;
      thresholdValueCents: number | null;
    }
  >();
  for (const c of (countersRes.data ?? []) as Array<{
    id: string;
    name: string;
    kind: string;
    threshold_count: number | null;
    threshold_value_cents: number | null;
  }>) {
    countersById.set(c.id, {
      name: c.name,
      kind: c.kind,
      thresholdCount: c.threshold_count,
      thresholdValueCents: c.threshold_value_cents,
    });
  }
  const contactsById = new Map<string, string | null>();
  for (const c of (contactsRes.data ?? []) as Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
  }>) {
    const parts = [c.first_name, c.last_name].filter((v): v is string => Boolean(v));
    contactsById.set(c.id, parts.length > 0 ? parts.join(" ") : null);
  }

  // Costruisco top 5 progressioni (in % vicinanza a soglia)
  const progressList: Array<{
    contactFullName: string | null;
    counterName: string;
    progress: number;
    threshold: number;
    percentComplete: number;
  }> = [];
  for (const [key, agg] of progressMap.entries()) {
    const [counterId, contactId] = key.split("|");
    if (!counterId || !contactId) continue;
    const counter = countersById.get(counterId);
    if (!counter) continue;
    const contactName = contactsById.get(contactId);
    if (contactName === undefined) continue; // contatto non esiste

    const progress = counter.kind === "valore_speso" ? agg.valueCents : agg.count;
    const threshold =
      counter.kind === "valore_speso"
        ? (counter.thresholdValueCents ?? 1)
        : (counter.thresholdCount ?? 1);
    const percentComplete = Math.min(100, Math.round((progress / threshold) * 100));
    if (percentComplete < 100 && percentComplete > 0) {
      progressList.push({
        contactFullName: contactName,
        counterName: counter.name,
        progress,
        threshold,
        percentComplete,
      });
    }
  }
  progressList.sort((a, b) => b.percentComplete - a.percentComplete);
  const topProgressingContacts = progressList.slice(0, 5);

  return {
    vouchersActive: activeRes.count ?? 0,
    vouchersRedeemed: redeemed,
    redemptionRatePct,
    expiringNext7d: expiringRes.count ?? 0,
    topProgressingContacts,
  };
}
