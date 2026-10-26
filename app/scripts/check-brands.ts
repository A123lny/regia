import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data, error } = await admin.from("brands").select("*");
  if (error) {
    console.log("Error:", error.message);
    return;
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  console.log(`Marchi: ${rows.length}`);
  for (const b of rows) {
    console.log(`  ${b["slug"]} | ${b["display_name"]} | archived=${b["is_archived"] ?? "?"}`);
  }
  if (rows.length > 0) {
    console.log(`\nColonne disponibili: ${Object.keys(rows[0]!).join(", ")}`);
  }
}
main();
