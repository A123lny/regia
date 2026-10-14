import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data, error } = await admin
    .from("abandonment_signals")
    .select(
      "id, kind, severity, signal_at, resolved_at, resolved_reason, notes, contact_id, previous_orders_count, current_orders_count, created_at, updated_at",
    )
    .order("created_at", { ascending: true });
  if (error) {
    console.error(error);
    process.exit(1);
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  console.log(`Totale: ${rows.length}`);
  console.log(`Attivi: ${rows.filter((r) => !r["resolved_at"]).length}`);
  console.log(`Risolti: ${rows.filter((r) => r["resolved_at"]).length}`);
  for (const r of rows) {
    const createdAt = (r["created_at"] as string).slice(0, 19).replace("T", " ");
    const resolvedAt = r["resolved_at"]
      ? (r["resolved_at"] as string).slice(0, 19).replace("T", " ")
      : "---";
    console.log(
      `  created=${createdAt} ${(r["severity"] as string).padEnd(6)} ${(r["kind"] as string).padEnd(20)} resolved=${resolvedAt.padEnd(20)} reason=${(r["resolved_reason"] as string) ?? "---"} notes=${((r["notes"] as string) ?? "").slice(0, 35)}`,
    );
  }
}
main();
