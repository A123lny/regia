"use server";

// Server action che riceve il form pubblico e chiama submitPublicSignup con l'IP client.

import { headers } from "next/headers";
import { submitPublicSignup } from "@/modules/m10-signup/server";
import type { PublicSignupInput, PublicSignupResult } from "@/modules/m10-signup/server";

async function extractClientIp(): Promise<string | undefined> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    return first ? first.trim() : undefined;
  }
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return undefined;
}

export async function submitSignupClient(
  input: Omit<PublicSignupInput, "ipAddress">,
): Promise<PublicSignupResult> {
  const ip = await extractClientIp();
  const withIp: PublicSignupInput = { ...input };
  if (ip) withIp.ipAddress = ip;
  return submitPublicSignup(withIp);
}
