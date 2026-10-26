import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data: brands } = await admin.from("brands").select("id, slug").eq("is_archived", false);
  const brandMap = new Map<string, string>();
  for (const b of (brands ?? []) as Array<Record<string, unknown>>) {
    brandMap.set(b["id"] as string, b["slug"] as string);
  }
  const { data } = await admin
    .from("brand_orders")
    .select("status, channel, total_cents, brand_id, placed_at");
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  console.log(`Ordini totali: ${rows.length}`);
  const byStatus = new Map<string, number>();
  const byChannel = new Map<string, number>();
  const byBrand = new Map<string, { count: number; totalCents: number }>();
  let totalCents = 0;
  for (const r of rows) {
    const s = (r["status"] as string) ?? "null";
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
    const c = (r["channel"] as string) ?? "null";
    byChannel.set(c, (byChannel.get(c) ?? 0) + 1);
    const slug = brandMap.get(r["brand_id"] as string) ?? "?";
    const cur = byBrand.get(slug) ?? { count: 0, totalCents: 0 };
    cur.count++;
    cur.totalCents += Number(r["total_cents"] ?? 0);
    byBrand.set(slug, cur);
    totalCents += Number(r["total_cents"] ?? 0);
  }
  console.log(`\nPer status:`);
  for (const [s, n] of byStatus) console.log(`  ${s}: ${n}`);
  console.log(`\nPer canale:`);
  for (const [c, n] of byChannel) console.log(`  ${c}: ${n}`);
  console.log(`\nPer brand:`);
  for (const [b, v] of byBrand)
    console.log(`  ${b}: ${v.count} ordini, totale EUR ${(v.totalCents / 100).toFixed(2)}`);
  console.log(`\nFatturato totale complessivo: EUR ${(totalCents / 100).toFixed(2)}`);
}
main();
