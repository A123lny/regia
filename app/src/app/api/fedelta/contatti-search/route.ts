// API route: ricerca contatti per l'autocomplete del form emissione voucher.

import { NextResponse } from "next/server";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listContacts } from "@/modules/m01-data-hub/public";

export async function GET(req: Request) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "voucher.issue")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ items: [] });

  const { items } = await listContacts({
    organizationId: session.organizationId,
    query: q.trim(),
    limit: 10,
  });

  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id,
      first_name: c.firstName,
      last_name: c.lastName,
      email: c.email,
    })),
  });
}
