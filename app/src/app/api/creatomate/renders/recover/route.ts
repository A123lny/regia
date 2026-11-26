// POST /api/creatomate/renders/recover
// Recovery di un render già creato su Creatomate ma non salvato in DB per
// errore (es. migration mancante al momento dell'avvio). Utile quando
// l'Owner ha l'external_id dal messaggio di errore ma la row non esiste.
//
// Body: { externalId, brandId, draftId? }
// Owner-only. Fa:
//  1) verifica che la riga NON esista già
//  2) chiama GET /v2/renders/:externalId sull'API Creatomate
//  3) crea la row in creatomate_renders in stato corrente
//  4) se è succeeded, scarica l'output e lo attacca come brand_media_asset

import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { getBrandById } from "@/modules/m02-brand/public";
import { getContentDraft } from "@/modules/m03-editorial/public";
import { getRender } from "@/lib/creatomate/client";
import {
  getRenderByExternalId,
  insertCreatomateRender,
} from "@/modules/m15-creatomate/public";
import { applySucceededRenderByExternalId } from "@/modules/m15-creatomate/server";

export async function POST(req: Request) {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "content.generate");
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body non valido." }, { status: 400 });
  }
  const b = body as { externalId?: unknown; brandId?: unknown; draftId?: unknown };
  if (typeof b.externalId !== "string" || !b.externalId) {
    return NextResponse.json({ ok: false, error: "externalId mancante." }, { status: 400 });
  }
  if (typeof b.brandId !== "string" || !b.brandId) {
    return NextResponse.json({ ok: false, error: "brandId mancante." }, { status: 400 });
  }

  const brand = await getBrandById(session.organizationId, b.brandId);
  if (!brand) {
    return NextResponse.json({ ok: false, error: "Marchio non trovato." }, { status: 404 });
  }

  const draftId = typeof b.draftId === "string" && b.draftId ? b.draftId : null;
  if (draftId) {
    const draft = await getContentDraft(draftId, session.organizationId);
    if (!draft || draft.brandId !== brand.id) {
      return NextResponse.json({ ok: false, error: "Bozza non valida." }, { status: 400 });
    }
  }

  // Già presente?
  const existing = await getRenderByExternalId(b.externalId);
  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyExisted: true,
      renderId: existing.id,
      status: existing.status,
    });
  }

  // Fetch da Creatomate
  let live;
  try {
    live = await getRender(b.externalId);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `Impossibile recuperare render da Creatomate: ${err instanceof Error ? err.message : "errore"}.`,
      },
      { status: 400 },
    );
  }

  const initialStatus =
    live.status === "succeeded"
      ? "succeeded"
      : live.status === "failed" || live.status === "cancelled"
        ? "failed"
        : live.status === "planned"
          ? "planned"
          : live.status === "rendering" || live.status === "transcribing"
            ? "rendering"
            : "queued";

  const webhookToken = randomBytes(24).toString("hex");

  // Insert (ora che la migration è applicata, questo non fallisce più)
  try {
    const row = await insertCreatomateRender({
      organizationId: session.organizationId,
      brandId: brand.id,
      ...(draftId ? { draftId } : {}),
      externalId: b.externalId,
      templateId: "__recovered",
      modifications: {},
      webhookToken,
      requestedBy: session.userId,
      initialStatus,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "creatomate.render_recovered",
      target: `render:${row.id}`,
      details: { externalId: b.externalId, status: initialStatus, ...(draftId ? { draftId } : {}) },
    });

    // Se è succeeded, fai il download+attach SUBITO
    if (initialStatus === "succeeded") {
      const applied = await applySucceededRenderByExternalId(b.externalId);
      return NextResponse.json({
        ok: true,
        recovered: true,
        renderId: row.id,
        applied: applied.ok ? "ok" : `fail: ${applied.ok === false ? applied.error : "?"}`,
      });
    }
    // Altrimenti ritorna comunque, il polling/webhook chiuderà il flusso
    return NextResponse.json({
      ok: true,
      recovered: true,
      renderId: row.id,
      status: initialStatus,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `Insert in DB fallita: ${err instanceof Error ? err.message : "errore"}. Verifica che la migration creatomate_renders sia applicata.`,
      },
      { status: 500 },
    );
  }
}
