// POST /api/creatomate/webhook?t=<token> — inbound Creatomate.
// Creatomate chiama questo URL quando il render è completato (success o fail).
// Verifica: query param `t` deve uguagliare il webhook_token della riga in DB
// (segreto per-render generato al momento di startRender). Il body contiene
// almeno { id, status, url?, snapshot_url?, error_message? } del render.
//
// NB: Creatomate NON firma il payload lato suo — l'autenticità viene dal token.

import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit/log";
import {
  getRenderByExternalId,
  applySucceededRender,
  updateRenderStatus,
} from "@/modules/m15-creatomate/public";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  if (!token) {
    return NextResponse.json({ ok: false, error: "token missing" }, { status: 400 });
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const p = payload as {
    id?: unknown;
    status?: unknown;
    url?: unknown;
    snapshot_url?: unknown;
    output_format?: unknown;
    width?: unknown;
    height?: unknown;
    duration?: unknown;
    error_message?: unknown;
  };
  const externalId = typeof p.id === "string" ? p.id : "";
  const status = typeof p.status === "string" ? p.status : "";
  if (!externalId || !status) {
    return NextResponse.json({ ok: false, error: "payload invalido" }, { status: 400 });
  }

  const row = await getRenderByExternalId(externalId);
  if (!row) {
    // Risposta 200: evita retry infiniti di Creatomate su render non nostri.
    return NextResponse.json({ ok: true, ignored: "unknown render" });
  }
  if (row.webhookToken !== token) {
    // Token non valido: non confermare che l'id esiste. 404 generico.
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  if (status === "succeeded" && typeof p.url === "string" && p.url) {
    try {
      await applySucceededRender(row.id, {
        organizationId: row.organizationId,
        brandId: row.brandId,
        draftId: row.draftId,
        externalId,
        outputUrl: p.url,
        snapshotUrl: typeof p.snapshot_url === "string" ? p.snapshot_url : null,
        outputFormat: typeof p.output_format === "string" ? p.output_format : null,
        width: typeof p.width === "number" ? p.width : null,
        height: typeof p.height === "number" ? p.height : null,
        durationSeconds: typeof p.duration === "number" ? p.duration : null,
        uploadedBy: row.requestedBy,
      });
    } catch (err) {
      console.error("[creatomate] webhook applySucceeded failed", {
        externalId,
        err: err instanceof Error ? err.message : String(err),
      });
      await updateRenderStatus({
        externalId,
        status: "failed",
        errorMessage:
          err instanceof Error
            ? `Download/save output fallito: ${err.message}`
            : "Errore ignoto salvataggio.",
      });
      return NextResponse.json({ ok: false, error: "save failed" }, { status: 200 });
    }
  } else if (status === "failed" || status === "cancelled") {
    const errMsg = typeof p.error_message === "string" ? p.error_message : `Render ${status}.`;
    await updateRenderStatus({ externalId, status: "failed", errorMessage: errMsg });
    await logAuditEvent({
      organizationId: row.organizationId,
      actorUserId: row.requestedBy,
      actorKind: "system",
      action: "creatomate.render_failed",
      target: `render:${row.id}`,
      details: { externalId, status, errorMessage: errMsg },
    });
  } else {
    // planned/rendering/transcribing: progress update
    const mapped =
      status === "rendering" || status === "transcribing"
        ? "rendering"
        : status === "planned"
          ? "planned"
          : "queued";
    await updateRenderStatus({ externalId, status: mapped as "queued" | "planned" | "rendering" });
  }

  return NextResponse.json({ ok: true });
}
