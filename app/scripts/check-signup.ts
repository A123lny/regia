import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data: landings } = await admin
    .from("signup_landings")
    .select("id, slug, headline, benefit_headline, is_active, brand_id, welcome_offer_id");
  console.log(`Landings: ${(landings ?? []).length}`);
  for (const l of (landings ?? []) as Array<Record<string, unknown>>) {
    console.log(
      `  /${l["slug"]} · "${(l["headline"] as string) ?? ""}" · active=${l["is_active"]} · offer=${l["welcome_offer_id"] ?? "null"}`,
    );
  }
  const { data: events } = await admin
    .from("signup_events")
    .select("id, landing_id, created_at, contact_id")
    .order("created_at", { ascending: false })
    .limit(10);
  console.log(`\nSignup events recenti: ${(events ?? []).length}`);
}
main();
