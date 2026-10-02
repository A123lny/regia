"use server";

import { headers } from "next/headers";
import { applyUnsubscribe, type ApplyUnsubscribeInput } from "@/modules/m05-publishing/public";

export async function submitUnsubscribeDetails(input: {
  token: string;
  reason: ApplyUnsubscribeInput["reason"];
  reasonFree: ApplyUnsubscribeInput["reasonFree"];
  reduceFrequency: boolean;
  alsoChannels: ApplyUnsubscribeInput["alsoChannels"];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for") ?? hdrs.get("x-real-ip") ?? undefined;
  const applyInput: ApplyUnsubscribeInput = {
    token: input.token,
    reduceFrequency: input.reduceFrequency,
  };
  if (input.reason !== undefined) applyInput.reason = input.reason;
  if (input.reasonFree !== undefined) applyInput.reasonFree = input.reasonFree;
  if (input.alsoChannels !== undefined) applyInput.alsoChannels = input.alsoChannels;
  if (ip) applyInput.ipAddress = ip;
  const result = await applyUnsubscribe(applyInput);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
