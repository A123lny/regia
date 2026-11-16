// RN-robot T5: endpoint SSE del robottino.
// Auth inline (no redirect: le API ritornano 401 invece che redirect UI).

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/db/server";
import { getAdminClient } from "@/lib/db/admin";
import type { Session } from "@/lib/auth/session";
import { runChat, type ChatSseEvent } from "@/modules/m14-robot-assistant/internal/chat-action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RoleEnum = z.enum(["owner", "editor", "delegate", "agent"]);

const RequestSchema = z.object({
  message: z.string().min(1, "message richiesto").max(4000, "message troppo lungo (max 4000)"),
  conversationId: z.string().uuid().nullable(),
  priorMessages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        timestamp: z.string(),
      }),
    )
    .max(50, "storia troppo lunga (max 50 messaggi)")
    .optional()
    .default([]),
  pageContext: z.object({
    pagePath: z.string(),
    pageTitle: z.string(),
    brandId: z.string().uuid().nullable(),
    visibleEntityIds: z.array(z.string()).optional(),
  }),
});

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

function encodeSse(event: ChatSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: Request) {
  const session = await resolveSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runChat({
          session,
          conversationId: body.conversationId,
          userMessage: body.message,
          priorMessages: body.priorMessages,
          pageContext: body.pageContext,
        })) {
          controller.enqueue(encoder.encode(encodeSse(event)));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "server error";
        controller.enqueue(
          encoder.encode(encodeSse({ type: "error", code: "server_error", message: msg })),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
