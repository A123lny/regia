import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data, error } = await admin
    .from("reminders")
    .select("id, kind, channel_hint, status, scheduled_at, sent_at, dismissed_at, message_hint")
    .order("scheduled_at", { ascending: true });
  if (error) {
    console.error(error);
    process.exit(1);
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const since30d = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const pending = rows.filter((r) => r["status"] === "pending");
  const sent = rows.filter((r) => r["status"] === "sent");
  const dismissed = rows.filter((r) => r["status"] === "dismissed");
  const expired = rows.filter((r) => r["status"] === "expired");
  const pendingToday = pending.filter(
    (r) => new Date(r["scheduled_at"] as string) <= now,
  );
  const pendingWeek = pending.filter(
    (r) => new Date(r["scheduled_at"] as string) <= in7days,
  );
  const sentLast30d = sent.filter(
    (r) => r["sent_at"] && new Date(r["sent_at"] as string) >= since30d,
  );
  const dismissedLast30d = dismissed.filter(
    (r) => r["dismissed_at"] && new Date(r["dismissed_at"] as string) >= since30d,
  );
  console.log(`Totale: ${rows.length}`);
  console.log(`Pending: ${pending.length} (oggi: ${pendingToday.length}, 7gg: ${pendingWeek.length})`);
  console.log(`Sent: ${sent.length} (ultimi 30gg: ${sentLast30d.length})`);
  console.log(`Dismissed: ${dismissed.length} (ultimi 30gg: ${dismissedLast30d.length})`);
  console.log(`Expired: ${expired.length}`);
  console.log("\nPending per kind:");
  const byKind = new Map<string, number>();
  for (const r of pending) {
    const k = r["kind"] as string;
    byKind.set(k, (byKind.get(k) ?? 0) + 1);
  }
  for (const [k, n] of byKind) console.log(`  ${k}: ${n}`);
  console.log("\nPending per canale:");
  const byChannel = new Map<string, number>();
  for (const r of pending) {
    const c = (r["channel_hint"] as string) ?? "null";
    byChannel.set(c, (byChannel.get(c) ?? 0) + 1);
  }
  for (const [c, n] of byChannel) console.log(`  ${c}: ${n}`);
}
main();
