import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data } = await admin
    .from("supply_partners")
    .select(
      "name, category, involvement_level, advance_notice_days, general_consent, veto_notes, archived_at",
    );
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  console.log(`Fornitori: ${rows.length}`);
  for (const s of rows) {
    const consent = s["general_consent"] ? "assenso-blanket" : "no-assenso";
    const veto = s["veto_notes"] ? ` [veto: ${(s["veto_notes"] as string).slice(0, 40)}]` : "";
    console.log(
      `  ${(s["name"] as string).padEnd(28)} | ${s["category"] ?? "—"} | ` +
        `livello=${s["involvement_level"]} | preavviso=${s["advance_notice_days"]}gg | ${consent}${veto}`,
    );
  }

  const { data: reqs } = await admin
    .from("partner_approval_requests")
    .select("partner_id, status, due_at, requested_at");
  const rRows = (reqs ?? []) as Array<Record<string, unknown>>;
  console.log(`\nRichieste approvazione: ${rRows.length}`);
  const byStatus = new Map<string, number>();
  for (const r of rRows) {
    const s = (r["status"] as string) ?? "null";
    byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
  }
  for (const [s, n] of byStatus) console.log(`  ${s}: ${n}`);
}
main();
