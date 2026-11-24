// GET /api/creatomate/templates — elenco template del progetto Creatomate.
// Richiede sessione. Risposta: { ok:true, items: [{id, name}] } | errore.
// Nota: piccola cache in-process 60s per non martellare l'API.

import { NextResponse } from "next/server";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { listTemplates } from "@/lib/creatomate/client";
import { CreatomateError } from "@/lib/creatomate/client";

type CachedTemplates = { at: number; items: Array<{ id: string; name: string }> };
let cache: CachedTemplates | null = null;
const CACHE_MS = 60_000;

export async function GET() {
  await getSessionOrRedirect();
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return NextResponse.json({ ok: true, items: cache.items, cached: true });
  }
  try {
    const items = await listTemplates();
    const slim = items.map((t) => ({
      id: t.id,
      name: t.name || t.id,
      ...(t.width ? { width: t.width } : {}),
      ...(t.height ? { height: t.height } : {}),
      ...(t.duration ? { duration: t.duration } : {}),
    }));
    cache = { at: now, items: slim };
    return NextResponse.json({ ok: true, items: slim });
  } catch (err) {
    const msg = err instanceof CreatomateError ? err.message : "Errore nel caricare i template.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
