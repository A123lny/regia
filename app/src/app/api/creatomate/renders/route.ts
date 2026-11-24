// POST /api/creatomate/renders — avvia un render.
// Body: { brandId, draftId?, templateId, modifications, quality?, outputFormat? }
// Risposta: { ok:true, renderId, externalId } | { ok:false, error }

import { NextResponse } from "next/server";
import { startCreatomateRender } from "@/modules/m15-creatomate/public";
import type { CreatomateRenderQuality } from "@/modules/m15-creatomate/public";

function isQuality(s: unknown): s is CreatomateRenderQuality {
  return s === "test" || s === "final";
}
function isFormat(s: unknown): s is "mp4" | "jpg" | "png" | "gif" | "webp" {
  return s === "mp4" || s === "jpg" || s === "png" || s === "gif" || s === "webp";
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Richiesta non valida." }, { status: 400 });
  }
  const b = body as {
    brandId?: unknown;
    draftId?: unknown;
    templateId?: unknown;
    modifications?: unknown;
    quality?: unknown;
    outputFormat?: unknown;
  };
  if (typeof b.brandId !== "string" || !b.brandId) {
    return NextResponse.json({ ok: false, error: "brandId mancante." }, { status: 400 });
  }
  if (typeof b.templateId !== "string" || !b.templateId) {
    return NextResponse.json({ ok: false, error: "templateId mancante." }, { status: 400 });
  }
  if (typeof b.modifications !== "object" || !b.modifications || Array.isArray(b.modifications)) {
    return NextResponse.json({ ok: false, error: "modifications non validi." }, { status: 400 });
  }
  const result = await startCreatomateRender({
    brandId: b.brandId,
    ...(typeof b.draftId === "string" && b.draftId ? { draftId: b.draftId } : {}),
    templateId: b.templateId,
    modifications: b.modifications as Record<string, unknown>,
    ...(isQuality(b.quality) ? { quality: b.quality } : {}),
    ...(isFormat(b.outputFormat) ? { outputFormat: b.outputFormat } : {}),
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
