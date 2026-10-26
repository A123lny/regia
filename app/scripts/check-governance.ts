import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);

  const { data: budgets } = await admin.from("advertising_budgets").select("*");
  console.log(`Advertising budgets: ${(budgets ?? []).length}`);
  for (const b of (budgets ?? []) as Array<Record<string, unknown>>) {
    console.log(
      `  brand=${b["brand_id"]} cat=${b["category"]} enabled=${b["enabled"]} amount=${b["monthly_cap_cents"]}`,
    );
  }

  const { data: overrun } = await admin
    .from("advertising_overrun_requests")
    .select("status, motivation, requested_amount_cents");
  console.log(`\nOverrun requests: ${(overrun ?? []).length}`);
  for (const o of (overrun ?? []) as Array<Record<string, unknown>>) {
    console.log(`  status=${o["status"]} amount=${o["requested_amount_cents"]}`);
  }

  const { data: zones } = await admin.from("delivery_zones").select("name, cap_prefixes, brand_id");
  console.log(`\nDelivery zones: ${(zones ?? []).length}`);
  for (const z of (zones ?? []) as Array<Record<string, unknown>>) {
    console.log(`  ${z["name"]} CAP=${JSON.stringify(z["cap_prefixes"])}`);
  }

  const { data: blackouts } = await admin
    .from("delivery_zone_blackouts")
    .select("zone_id, kind, start_at, end_at, closed_at");
  console.log(`\nBlackouts: ${(blackouts ?? []).length}`);
  for (const b of (blackouts ?? []) as Array<Record<string, unknown>>) {
    const active = b["closed_at"] === null && new Date(b["start_at"] as string) <= new Date();
    console.log(`  kind=${b["kind"]} start=${b["start_at"]} ${active ? "[ATTIVO]" : ""}`);
  }

  const { data: windows } = await admin
    .from("rider_capacity_windows")
    .select("weekday, time_of_day, total_slots, slots_filled");
  console.log(`\nRider windows: ${(windows ?? []).length}`);
  for (const w of (windows ?? []) as Array<Record<string, unknown>>) {
    const full = w["slots_filled"] === w["total_slots"];
    console.log(
      `  weekday=${w["weekday"]} ${w["time_of_day"]}: ${w["slots_filled"]}/${w["total_slots"]} ${full ? "[FULL]" : ""}`,
    );
  }

  const { data: reqs } = await admin.from("rider_requests").select("status, slots_needed, reason");
  console.log(`\nRider requests: ${(reqs ?? []).length}`);
  for (const r of (reqs ?? []) as Array<Record<string, unknown>>) {
    console.log(`  status=${r["status"]} slots=${r["slots_needed"]}`);
  }
}
main();
