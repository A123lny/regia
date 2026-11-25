// GET /api/creatomate/templates — elenco template registrati per il brand.
// Gated su capability "brand.kit.edit" (Owner/Editor): la lista è usata solo
// dalla sezione "Template Creatomate" del marchio per l'admin.
//
// La route NON ritorna i template-grezzi del progetto Creatomate (shared
// multi-tenant via API key unica = cross-tenant info disclosure); ritorna
// soltanto le mappature brand_creatomate_templates della propria org, che
// sono già bound al tenant. Chi configura un nuovo template conosce
// l'ID copiandolo dal dashboard Creatomate e lo digita a mano.
//
// Cache per-org: l'endpoint è chiamato di rado (sezione admin) quindi
// torniamo a hit DB diretto senza cache in-memory.

import { NextResponse } from "next/server";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { listBrandTemplates } from "@/modules/m15-creatomate/public";

export async function GET(req: Request) {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "brand.kit.edit");
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." },
      { status: 403 },
    );
  }
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brandId") ?? "";
  if (!brandId) {
    return NextResponse.json({ ok: false, error: "brandId mancante" }, { status: 400 });
  }
  try {
    const rows = await listBrandTemplates(session.organizationId, brandId, true);
    const items = rows.map((r) => ({ id: r.templateId, name: r.label }));
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Errore nel caricare i template.",
      },
      { status: 400 },
    );
  }
}
