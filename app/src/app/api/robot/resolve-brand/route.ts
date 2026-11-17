// RN-robot: endpoint picker brand. Riceve actionId + brandId scelto dall'utente,
// crea nuovo pending con brandId merged in toolInput, ritorna newActionId + summary
// per il confirm dialog standard.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerClient } from "@/lib/db/server";
import { getAdminClient } from "@/lib/db/admin";
import type { Session } from "@/lib/auth/session";
import { resolveBrandSelection } from "@/modules/m14-robot-assistant/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RoleEnum = z.enum(["owner", "editor", "delegate", "agent"]);
const RequestSchema = z.object({
  actionId: z.string().uuid(),
  brandId: z.string().uuid(),
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

export async function POST(req: Request) {
  const session = await resolveSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid body" },
      { status: 400 },
    );
  }

  const result = await resolveBrandSelection(session, body.actionId, body.brandId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    newActionId: result.newActionId,
    toolName: result.toolName,
    summary: result.summary,
  });
}
