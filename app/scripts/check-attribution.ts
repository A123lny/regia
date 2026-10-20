import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data } = await admin.from("vouchers").select("status, source_draft_id");
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const attributed = rows.filter((v) => v["source_draft_id"]);
  const attrRedeemed = attributed.filter((v) => v["status"] === "redeemed");
  console.log(`Totali: ${rows.length}`);
  console.log(`Attribuiti: ${attributed.length}`);
  console.log(`Attribuiti redeemed: ${attrRedeemed.length}`);
  console.log(`Copertura: ${Math.round((attributed.length / rows.length) * 100)}%`);
}
main();
