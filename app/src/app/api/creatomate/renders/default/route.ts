// POST /api/creatomate/renders/default — avvia render con RenderScript inline
// (nessun template preregistrato richiesto). Body:
//   { brandId, draftId?, variant, shortTitle, body, ctaText? }

import { NextResponse } from "next/server";
import {
  startCreatomateDefaultRender,
  type DefaultVariant,
} from "@/modules/m15-creatomate/public";

function isVariant(s: unknown): s is DefaultVariant {
  return s === "square_post" || s === "story_reel" || s === "poster_a4";
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
    variant?: unknown;
    shortTitle?: unknown;
    body?: unknown;
    ctaText?: unknown;
  };
  if (typeof b.brandId !== "string" || !b.brandId) {
    return NextResponse.json({ ok: false, error: "brandId mancante." }, { status: 400 });
  }
  if (!isVariant(b.variant)) {
    return NextResponse.json({ ok: false, error: "variant non valida." }, { status: 400 });
  }
  const shortTitle = typeof b.shortTitle === "string" ? b.shortTitle : "";
  const txt = typeof b.body === "string" ? b.body : "";
  if (!shortTitle.trim()) {
    return NextResponse.json({ ok: false, error: "Titolo mancante." }, { status: 400 });
  }
  const result = await startCreatomateDefaultRender({
    brandId: b.brandId,
    ...(typeof b.draftId === "string" && b.draftId ? { draftId: b.draftId } : {}),
    variant: b.variant,
    shortTitle,
    body: txt,
    ...(typeof b.ctaText === "string" && b.ctaText.trim() ? { ctaText: b.ctaText } : {}),
  });
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
