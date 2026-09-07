"use server";

import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/db/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // In F0 il feedback errore è minimale. F1: pagina con messaggi tradotti.
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/dashboard");
}
