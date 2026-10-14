import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  const admin = createClient(url, key);
  const { data: profiles } = await admin
    .from("users_profile")
    .select("user_id, role, organization_id");
  for (const p of (profiles ?? []) as Array<Record<string, unknown>>) {
    const { data: u } = await admin.auth.admin.getUserById(p["user_id"] as string);
    console.log(
      `${p["role"]} · ${u.user?.email} · org=${p["organization_id"]} · uid=${p["user_id"]}`,
    );
  }
}
main();
