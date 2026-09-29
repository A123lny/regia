// API route interna: dettaglio contatto (consensi + veicoli) per il drawer.
// Autenticazione via session cookie; tenant-scoped su organization_id.
// Ritorna JSON minimo per non appesantire il primo render della lista.

import { NextResponse } from "next/server";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import {
  getContact,
  listConsentsByContact,
  listVehiclesByContact,
} from "@/modules/m01-data-hub/public";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "contacts.read")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;

  const contact = await getContact(id, session.organizationId);
  if (!contact) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [consents, vehicles] = await Promise.all([
    listConsentsByContact(id, session.organizationId),
    listVehiclesByContact(id, session.organizationId),
  ]);

  return NextResponse.json({ consents, vehicles });
}
