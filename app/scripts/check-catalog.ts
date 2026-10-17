import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data: brands } = await admin
    .from("brands")
    .select("id, slug")
    .eq("is_archived", false);
  const brandMap = new Map<string, string>();
  for (const b of (brands ?? []) as Array<Record<string, unknown>>) {
    brandMap.set(b["id"] as string, b["slug"] as string);
  }
  const { data } = await admin
    .from("brand_products")
    .select(
      "name, category, price_current_cents, cost_current_cents, min_margin_pct, brand_id",
    );
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  console.log(`Prodotti: ${rows.length}`);
  for (const p of rows) {
    const slug = brandMap.get(p["brand_id"] as string) ?? "?";
    const cost = p["cost_current_cents"];
    const margin = p["min_margin_pct"];
    console.log(
      `  ${slug.padEnd(10)} | ${(p["name"] as string).padEnd(28)} | ` +
        `prezzo=${p["price_current_cents"]} | cost=${cost === null ? "NULL" : cost} | ` +
        `margin=${margin === null ? "NULL" : margin + "%"}`,
    );
  }
}
main();
