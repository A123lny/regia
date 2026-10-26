// One-off: cancella il task di test "kiiii" lasciato dallo smoke manuale.

import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data, error } = await admin
    .from("operational_tasks")
    .delete({ count: "exact" })
    .eq("title", "kiiii")
    .select("id");
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(`Cancellati ${(data ?? []).length} task di test`);
}
main();
