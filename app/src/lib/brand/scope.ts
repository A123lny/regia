"use server";

// Cookie brand scope: gestione dello scope corrente (marchio selezionato o vista di gruppo).
// RF-2.6: isolamento per marchio + vista di gruppo per l'Owner.
// Nome cookie: regia_brand_scope. Valori: slug marchio ("lenny"|"stazione"|"eni-cafe"|"officina") o "all".

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const COOKIE_NAME = "regia_brand_scope";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 giorni

const ALLOWED_SCOPES = new Set(["all", "lenny", "stazione", "eni-cafe", "officina"]);

export async function getBrandScope(): Promise<string> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value ?? "all";
  return ALLOWED_SCOPES.has(value) ? value : "all";
}

export async function setBrandScope(slug: string): Promise<void> {
  if (!ALLOWED_SCOPES.has(slug)) {
    throw new Error(`Brand scope non valido: ${slug}`);
  }
  const store = await cookies();
  store.set(COOKIE_NAME, slug, {
    maxAge: MAX_AGE_SECONDS,
    sameSite: "lax",
    httpOnly: false,
    path: "/",
  });
  revalidatePath("/", "layout");
}
