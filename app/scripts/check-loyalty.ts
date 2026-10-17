import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);

  const { data: offers, error: offersErr } = await admin
    .from("voucher_offers")
    .select(
      "id, name, reward_kind, reward_value_cents, reward_pct, reward_label, is_active, issuer_brand_id",
    );
  if (offersErr) console.log("offers error:", offersErr.message);
  const offerRows = (offers ?? []) as Array<Record<string, unknown>>;
  console.log(`Offerte: ${offerRows.length}`);
  for (const o of offerRows) {
    const value =
      o["reward_value_cents"] ??
      (o["reward_pct"] !== null ? `${o["reward_pct"]}%` : o["reward_label"]) ??
      "-";
    console.log(
      `  ${o["name"]} | kind=${o["reward_kind"]} | reward=${value} | active=${o["is_active"]}`,
    );
  }

  const { data: vouchers } = await admin
    .from("vouchers")
    .select("status, issued_at, redeemed_at, expires_at");
  const vRows = (vouchers ?? []) as Array<Record<string, unknown>>;
  const byStatus = new Map<string, number>();
  for (const v of vRows) {
    const s = v["status"] as string;
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
  }
  console.log(`\nVoucher totali: ${vRows.length}`);
  for (const [s, n] of byStatus) console.log(`  ${s}: ${n}`);

  const { data: counters } = await admin
    .from("loyalty_counters")
    .select("id, name, is_active, brands(slug)");
  const cRows = (counters ?? []) as Array<Record<string, unknown>>;
  console.log(`\nContatori: ${cRows.length}`);
  for (const c of cRows) {
    const brands = c["brands"] as Record<string, string> | undefined;
    console.log(`  ${brands?.["slug"] ?? "?"} | ${c["name"]} | active=${c["is_active"]}`);
  }
}
main();
