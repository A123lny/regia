// RN-robot: endpoint cronologia conversazioni robottino.
//
// GET /api/robot/history                      -> lista ultime 20 conv del user
// GET /api/robot/history?conversationId=UUID  -> messaggi di quella conv

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/db/server";
import { getAdminClient } from "@/lib/db/admin";
import type { Session } from "@/lib/auth/session";
import {
  listUserConversations,
  getConversationMessages,
} from "@/modules/m14-robot-assistant/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RoleEnum = z.enum(["owner", "editor", "delegate", "agent"]);

async function resolveSession(): Promise<Session | null> {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: profile } = await admin
    .from("users_profile")
    .select("organization_id, role, is_archived, last_login_at")
    .eq("user_id", user.id)
    .single();
  if (!profile || profile.is_archived) return null;
  const role = RoleEnum.safeParse(profile.role);
  if (!role.success) return null;
  return {
    userId: user.id,
    role: role.data,
    organizationId: profile.organization_id as string,
    previousLoginAt: profile.last_login_at ?? null,
  };
}

export async function GET(req: Request) {
  const session = await resolveSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");

  if (conversationId) {
    const uuid = z.string().uuid().safeParse(conversationId);
    if (!uuid.success) {
      return NextResponse.json({ error: "invalid conversationId" }, { status: 400 });
    }
    const messages = await getConversationMessages(
      uuid.data,
      session.userId,
      session.organizationId,
    );
    if (messages === null) {
      return NextResponse.json({ error: "not_found_or_forbidden" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, messages });
  }

  const list = await listUserConversations(session.userId, session.organizationId, 20);
  return NextResponse.json({ ok: true, conversations: list });
}
