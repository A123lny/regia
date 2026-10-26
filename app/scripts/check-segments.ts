import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data } = await admin
    .from("contact_segments")
    .select("name, criteria, contact_count_materialized, is_active, brands(slug, display_name)");
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  console.log(`Segmenti: ${rows.length}`);
  for (const s of rows) {
    const brands = s["brands"] as Record<string, string> | undefined;
    console.log(
      `  ${brands?.["slug"] ?? "?"} | ${s["name"]} | ${s["is_active"] ? "attivo" : "inattivo"} | ${s["contact_count_materialized"]} contatti`,
    );
    console.log(`    criteria: ${JSON.stringify(s["criteria"])}`);
  }
}
main();
