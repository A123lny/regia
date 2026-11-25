// POST /api/creatomate/webhook?t=<token>
// Notifica da Creatomate quando un render cambia stato. Non ci fidiamo
// dell'URL di output nel payload (SSRF): per 'succeeded' deleghiamo ad
// applySucceededRenderByExternalId che re-fetcha l'URL via API autenticata,
// fa claim atomico (idempotente) e scarica solo da host allowlisted.

import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit/log";
import { getRenderByExternalId, updateRenderStatus } from "@/modules/m15-creatomate/public";
import { applySucceededRenderByExternalId } from "@/modules/m15-creatomate/server";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("t");
  if (!token) return NextResponse.json({ ok: false, error: "token missing" }, { status: 400 });

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }
  const p = payload as { id?: unknown; status?: unknown; error_message?: unknown };
  const externalId = typeof p.id === "string" ? p.id : "";
  const status = typeof p.status === "string" ? p.status : "";
  if (!externalId || !status) {
    return NextResponse.json({ ok: false, error: "payload invalido" }, { status: 400 });
  }

  const row = await getRenderByExternalId(externalId);
  if (!row) {
    // Evita retry: rispondiamo 200 per render non nostri.
    return NextResponse.json({ ok: true, ignored: "unknown render" });
  }
  if (row.webhookToken !== token) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  // Idempotenza: se la row è già finale, non facciamo nulla.
  if (row.status === "succeeded" || row.status === "failed" || row.status === "cancelled") {
    return NextResponse.json({ ok: true, idempotent: true });
  }

  if (status === "succeeded") {
    const applied = await applySucceededRenderByExternalId(externalId);
    if (!applied.ok) {
      console.error("[creatomate webhook] apply failed", { externalId, err: applied.error });
      // Risposta 200: Creatomate non deve ritentare se il nostro problema
      // è interno (re-fetch, bucket, etc.). Lo stato render è già stato
      // scritto come failed da apply.
      return NextResponse.json({ ok: false, error: applied.error }, { status: 200 });
    }
    return NextResponse.json({ ok: true });
  }

  if (status === "failed" || status === "cancelled") {
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
    return NextResponse.json({ ok: true });
  }

  // Progress update (planned/rendering/transcribing/queued)
  const mapped =
    status === "rendering" || status === "transcribing"
      ? "rendering"
      : status === "planned"
        ? "planned"
        : "queued";
  await updateRenderStatus({
    externalId,
    status: mapped as "queued" | "planned" | "rendering",
  });
  return NextResponse.json({ ok: true });
}
