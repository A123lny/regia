"use server";

// Server action per la Home Oggi: riceve testo + brand, verifica capability
// e ownership del brand, imposta il cookie HttpOnly con il testo precompilato
// (lo stesso che usa /contenuti/[slug]/nuovo come fallback), poi redirect
// SENZA query string sensibili.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { getBrandBySlug } from "@/modules/m02-brand/public";

const DRAFT_COOKIE_NAME = "m03_new_theme";

export async function startNewPostAction(input: {
  brandSlug: string;
  text: string;
}): Promise<void> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");

  const text = (input.text ?? "").slice(0, 2000).trim();
  if (text.length === 0) return;

  const brand = await getBrandBySlug(session.organizationId, input.brandSlug);
  if (!brand) return;

  const jar = await cookies();
  jar.set({
    name: DRAFT_COOKIE_NAME,
    value: text,
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    maxAge: 60,
    path: `/contenuti/${brand.slug}/nuovo`,
  });

  redirect(`/contenuti/${brand.slug}/nuovo`);
}
