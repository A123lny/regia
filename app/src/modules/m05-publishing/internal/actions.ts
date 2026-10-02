"use server";

import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import {
  upsertChannelCredentials,
  setChannelEnabled,
  markChannelVerified,
  listChannelCredentials,
} from "./credentials-repo";
import { getAdapter } from "./adapter-registry";
import { loadAdapterCredentials } from "./credentials-repo";
import type { Channel } from "./types";

export async function updateChannelCredentialsAction(input: {
  channel: Channel;
  provider: string;
  apiKey: string;
  config: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "publishing.credentials.manage");
  try {
    await upsertChannelCredentials({ organizationId: session.organizationId, ...input });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "publishing.credentials_updated",
      details: { channel: input.channel, provider: input.provider },
    });
    revalidatePath("/impostazioni");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function setChannelEnabledAction(input: {
  channel: Channel;
  enabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "publishing.credentials.manage");
  try {
    await setChannelEnabled(session.organizationId, input.channel, input.enabled);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.enabled ? "publishing.channel_enabled" : "publishing.channel_disabled",
      details: { channel: input.channel },
    });
    revalidatePath("/impostazioni");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function testChannelAction(input: {
  channel: Channel;
  testAddress: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "publishing.send");
  try {
    const loaded = await loadAdapterCredentials(session.organizationId, input.channel);
    if (!loaded) return { ok: false, error: `Nessuna credenziale ${input.channel}` };
    const adapter = await getAdapter(input.channel, loaded.provider);
    const ping = await adapter.ping(loaded.credentials);
    if (!ping.ok) {
      await markChannelVerified(session.organizationId, input.channel, false, ping.error);
      return { ok: false, error: ping.error };
    }
    await markChannelVerified(session.organizationId, input.channel, true);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "publishing.channel_test",
      details: { channel: input.channel, address: input.testAddress },
    });
    revalidatePath("/impostazioni");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function listChannelsAction() {
  const session = await getSessionOrRedirect();
  requireCapability(session, "publishing.credentials.manage");
  return listChannelCredentials(session.organizationId);
}
