import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data, error } = await admin
    .from("operational_tasks")
    .select("id, title, priority, status, due_at, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error(error);
    process.exit(1);
  }
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  console.log(`Totale task recenti: ${rows.length}`);
  for (const r of rows) {
    const due = r["due_at"] as string | null;
    const dueLocal = due ? new Date(due).toLocaleString("it-IT", { timeZone: "Europe/Rome" }) : "—";
    const createdLocal = new Date(r["created_at"] as string).toLocaleString("it-IT", {
      timeZone: "Europe/Rome",
    });
    console.log(
      `  ${r["status"]} · ${r["priority"]} · due_at=${due ?? "null"} (${dueLocal}) · created=${createdLocal} · "${r["title"]}"`,
    );
  }
}
main();
