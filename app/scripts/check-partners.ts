import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data } = await admin
    .from("partner_restaurants")
    .select(
      "name, onboarding_status, cuisine_category, cooling_flag, cooling_reason, launched_at, last_contact_at, address_cap",
    );
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  console.log(`Ristoranti Lenny: ${rows.length}`);
  for (const p of rows) {
    const launchedAt = p["launched_at"] as string | null;
    const daysLaunched = launchedAt
      ? Math.floor((Date.now() - new Date(launchedAt).getTime()) / (24 * 3600 * 1000))
      : null;
    const launchingTag =
      daysLaunched !== null && daysLaunched <= 30 ? ` [launching +${daysLaunched}gg]` : "";
    const coolingTag = p["cooling_flag"] ? ` [COOLING: ${p["cooling_reason"]}]` : "";
    console.log(
      `  ${(p["name"] as string).padEnd(28)} | ${p["onboarding_status"]} | ` +
        `${p["cuisine_category"] ?? "—"} | CAP ${p["address_cap"] ?? "—"}${launchingTag}${coolingTag}`,
    );
  }
  const { data: errors } = await admin
    .from("partner_delivery_errors")
    .select("partner_id, severity, occurred_at");
  console.log(`\nErrori consegna totali: ${(errors ?? []).length}`);
}
main();
