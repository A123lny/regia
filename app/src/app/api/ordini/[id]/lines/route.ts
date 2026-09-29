// API route interna: righe di un ordine per il drawer.

import { NextResponse } from "next/server";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { getOrder, listOrderLines } from "@/modules/m01-data-hub/public";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "orders.read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;

  // Tenant-scoping: ordine deve appartenere alla mia org
  const order = await getOrder(id, session.organizationId);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const lines = await listOrderLines(id);
  return NextResponse.json({ lines });
}
