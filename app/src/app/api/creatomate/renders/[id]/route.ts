// GET /api/creatomate/renders/[id] — polling fallback. Se la riga è ancora
// pending in DB, chiama Creatomate per aggiornare lo stato. Se risulta
// succeeded, scarica l'output e lo salva come brand_media_asset.

import { NextResponse } from "next/server";
import { getCreatomateRenderStatus } from "@/modules/m15-creatomate/public";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: "id mancante" }, { status: 400 });
  const r = await getCreatomateRenderStatus({ renderId: id });
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json(r);
}
