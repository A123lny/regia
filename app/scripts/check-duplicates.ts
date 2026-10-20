import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data } = await admin
    .from("contacts")
    .select("first_name, last_name, email, phone, whatsapp, is_duplicate_of")
    .is("archived_at", null);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  console.log(`Totale contatti attivi: ${rows.length}`);

  const normalize = (s: string | null | undefined) =>
    s ? s.replace(/[\s+\-()]/g, "").toLowerCase() : null;

  const emailMap = new Map<string, Array<string>>();
  const phoneMap = new Map<string, Array<string>>();
  const waMap = new Map<string, Array<string>>();
  for (const c of rows) {
    if (c["is_duplicate_of"]) continue;
    const name = `${c["first_name"]} ${c["last_name"]}`;
    const email = c["email"] ? (c["email"] as string).toLowerCase() : null;
    const phone = normalize(c["phone"] as string | null);
    const wa = normalize(c["whatsapp"] as string | null);
    if (email) emailMap.set(email, [...(emailMap.get(email) ?? []), name]);
    if (phone) phoneMap.set(phone, [...(phoneMap.get(phone) ?? []), name]);
    if (wa) waMap.set(wa, [...(waMap.get(wa) ?? []), name]);
  }

  console.log(`\nMatch per EMAIL (gruppi con >=2):`);
  for (const [e, names] of emailMap) {
    if (names.length >= 2) console.log(`  ${e} -> ${names.join(" | ")}`);
  }
  console.log(`\nMatch per PHONE (gruppi con >=2):`);
  for (const [p, names] of phoneMap) {
    if (names.length >= 2) console.log(`  ${p} -> ${names.join(" | ")}`);
  }
  console.log(`\nMatch per WHATSAPP (gruppi con >=2):`);
  for (const [w, names] of waMap) {
    if (names.length >= 2) console.log(`  ${w} -> ${names.join(" | ")}`);
  }
}
main();
