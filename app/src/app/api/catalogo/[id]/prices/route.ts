// API route interna: storico prezzi di un prodotto per il drawer catalogo.

import { NextResponse } from "next/server";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { getProduct, listPriceHistoryByProduct } from "@/modules/m01-data-hub/public";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "catalog.read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const product = await getProduct(id, session.organizationId);
  if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const history = await listPriceHistoryByProduct(id, session.organizationId);
  return NextResponse.json({ history });
}
