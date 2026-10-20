import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data: contacts } = await admin
    .from("contacts")
    .select("id, first_name, last_name, email, source, tags, archived_at");
  const rows = (contacts ?? []) as Array<Record<string, unknown>>;
  console.log(`Contatti totali: ${rows.length}`);
  const active = rows.filter((r) => !r["archived_at"]);
  console.log(`Attivi: ${active.length} | Archiviati: ${rows.length - active.length}`);

  const bySource = new Map<string, number>();
  const byTag = new Map<string, number>();
  for (const c of active) {
    const s = (c["source"] as string) ?? "—";
    bySource.set(s, (bySource.get(s) ?? 0) + 1);
    for (const t of (c["tags"] as string[]) ?? []) {
      byTag.set(t, (byTag.get(t) ?? 0) + 1);
    }
  }
  console.log(`\nPer sorgente:`);
  for (const [s, n] of bySource) console.log(`  ${s}: ${n}`);
  console.log(`\nPer tag:`);
  for (const [t, n] of byTag) console.log(`  ${t}: ${n}`);

  const { data: consents } = await admin
    .from("contact_consents")
    .select("channel, status");
  const cRows = (consents ?? []) as Array<Record<string, unknown>>;
  console.log(`\nConsensi totali: ${cRows.length}`);
  const byChannel = new Map<string, { granted: number; revoked: number }>();
  for (const c of cRows) {
    const ch = c["channel"] as string;
    const cur = byChannel.get(ch) ?? { granted: 0, revoked: 0 };
    if (c["status"] === "granted") cur.granted++;
    else if (c["status"] === "revoked") cur.revoked++;
    byChannel.set(ch, cur);
  }
  for (const [ch, v] of byChannel)
    console.log(`  ${ch}: ${v.granted} granted · ${v.revoked} revoked`);

  const { data: vehicles } = await admin.from("contact_vehicles").select("id");
  console.log(`\nVeicoli: ${(vehicles ?? []).length}`);

  const { data: dataReqs } = await admin
    .from("contact_data_requests")
    .select("id, request_type, status");
  console.log(`\nRichieste GDPR: ${(dataReqs ?? []).length}`);
}
main();
