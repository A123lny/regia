// Upload media via API Route invece che via Server Action.
// Motivo: la server action su Vercel andava in React error #441 con file
// anche piccoli (il body veniva serializzato dal protocollo RSC e un payload
// multipart da ~1MB rompeva la risposta). Un POST classico multipart/form-data
// su route handler aggira il problema e permette errori HTTP espliciti.

import { NextResponse } from "next/server";
import { uploadMediaAsset } from "@/modules/m04-media/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const brandId = String(formData.get("brandId") ?? "");
    if (!brandId) {
      return NextResponse.json({ error: "brandId mancante" }, { status: 400 });
    }
    const asset = await uploadMediaAsset(brandId, formData);
    return NextResponse.json({ ok: true, asset });
  } catch (err) {
    // Log server-side (lo vedi in Vercel log). Al client messaggio generico
    // al posto del dettaglio tecnico — evita leak di errori Supabase storage.
    console.error("[api/media/upload] fallito", {
      err: err instanceof Error ? err.message : String(err),
    });
    const message = err instanceof Error ? err.message : "errore sconosciuto";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 },
    );
  }
}
