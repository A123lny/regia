import { describe, expect, it } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  startConversation,
  touchConversation,
  endConversation,
  getConversation,
} from "../../src/modules/m14-robot-assistant/internal/conversation-repo";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!serviceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY non impostata. Carica app/.env.local prima dei test.");
}

const admin: SupabaseClient = createClient(url, serviceKey);
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const ORG_ID_OTHER = "00000000-0000-0000-0000-000000000002";

async function getFirstUserId(): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1 });
  return data?.users?.[0]?.id ?? null;
}

describe("RN-robot T3 · conversation-repo", () => {
  it("startConversation crea row e ritorna id (brand_id null ammesso)", async () => {
    const userId = await getFirstUserId();
    if (!userId) {
      console.warn("[robot-conv] nessun utente auth.users: skipped");
      return;
    }

    const convId = await startConversation({
      userId,
      organizationId: ORG_ID,
      brandId: null,
    });
    expect(convId).toMatch(/^[0-9a-f-]{36}$/);

    const conv = await getConversation(convId, ORG_ID);
    expect(conv).not.toBeNull();
    expect(conv?.brandId).toBeNull();
    expect(conv?.toolCallsCount).toBe(0);
    expect(conv?.endedAt).toBeNull();

    // Cleanup
    await admin.from("robot_conversations").delete().eq("id", convId);
  });

  it("touchConversation aggiorna last_message_at", async () => {
    const userId = await getFirstUserId();
    if (!userId) return;

    const convId = await startConversation({ userId, organizationId: ORG_ID, brandId: null });
    const before = await getConversation(convId, ORG_ID);

    await new Promise((r) => setTimeout(r, 50));
    await touchConversation(convId);
    const after = await getConversation(convId, ORG_ID);

    expect(new Date(after!.lastMessageAt).getTime()).toBeGreaterThan(
      new Date(before!.lastMessageAt).getTime(),
    );

    await admin.from("robot_conversations").delete().eq("id", convId);
  });

  it("touchConversation con incrementToolCalls=true incrementa il counter", async () => {
    const userId = await getFirstUserId();
    if (!userId) return;

    const convId = await startConversation({ userId, organizationId: ORG_ID, brandId: null });
    await touchConversation(convId, { incrementToolCalls: true });
    await touchConversation(convId, { incrementToolCalls: true });
    const after = await getConversation(convId, ORG_ID);
    expect(after?.toolCallsCount).toBe(2);

    await admin.from("robot_conversations").delete().eq("id", convId);
  });

  it("endConversation setta ended_at", async () => {
    const userId = await getFirstUserId();
    if (!userId) return;

    const convId = await startConversation({ userId, organizationId: ORG_ID, brandId: null });
    await endConversation(convId);
    const after = await getConversation(convId, ORG_ID);
    expect(after?.endedAt).not.toBeNull();

    await admin.from("robot_conversations").delete().eq("id", convId);
  });

  it("getConversation ritorna null per org diversa (tenant isolation)", async () => {
    const userId = await getFirstUserId();
    if (!userId) return;

    const convId = await startConversation({ userId, organizationId: ORG_ID, brandId: null });
    const leaked = await getConversation(convId, ORG_ID_OTHER);
    expect(leaked).toBeNull();

    await admin.from("robot_conversations").delete().eq("id", convId);
  });
});
