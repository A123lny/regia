// API route: log attività per un partner (drawer detail).

import { NextResponse } from "next/server";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { getPartner, listActivitiesByPartner } from "@/modules/m07-partners/public";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "partner.read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const partner = await getPartner(id, session.organizationId);
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const activities = await listActivitiesByPartner(id, session.organizationId);
  return NextResponse.json({ activities });
}
