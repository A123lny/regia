"use server";

// Server action per impostare il cookie di filtro marchio globale.

import { cookies } from "next/headers";
import { BRAND_FILTER_COOKIE } from "@/lib/ui/brand-filter";

export async function setBrandFilterAction(slug: string): Promise<void> {
  const jar = await cookies();
  jar.set({
    name: BRAND_FILTER_COOKIE,
    value: slug,
    httpOnly: false, // leggibile anche da JS (serve a eventuale sync lato client)
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90, // 90 giorni
  });
}
