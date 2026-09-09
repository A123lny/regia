"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/db/server";

export async function logout() {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
