import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data, error } = await admin
    .from("content_drafts")
    .select("id, status, theme_input, brand_id, scheduled_at, published_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  console.log(`Totale bozze recenti: ${rows.length}`);
  const byStatus = new Map<string, number>();
  for (const r of rows) {
    const s = (r["status"] as string) ?? "null";
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
  }
  console.log("\nBreakdown per status:");
  for (const [s, n] of byStatus) console.log(`  ${s}: ${n}`);

  const { data: brands } = await admin
    .from("brands")
    .select("id, slug, display_name")
    .eq("is_archived", false);
  const brandMap = new Map<string, string>();
  for (const b of (brands ?? []) as Array<Record<string, unknown>>) {
    brandMap.set(b["id"] as string, b["slug"] as string);
  }

  console.log("\nBreakdown per brand:");
  const byBrand = new Map<string, number>();
  for (const r of rows) {
    const slug = brandMap.get(r["brand_id"] as string) ?? "unknown";
    byBrand.set(slug, (byBrand.get(slug) ?? 0) + 1);
  }
  for (const [b, n] of byBrand) console.log(`  ${b}: ${n}`);
}
main();
