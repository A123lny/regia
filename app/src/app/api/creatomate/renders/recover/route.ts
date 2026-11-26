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
import { logAuditEvent } from "@/lib/audit/log";
import { getAdminClient } from "@/lib/db/admin";
import { getBrandById } from "@/modules/m02-brand/public";
import { getContentDraft } from "@/modules/m03-editorial/public";
import { getRender } from "@/lib/creatomate/client";
import {
  getRenderByExternalId,
  insertCreatomateRender,
} from "@/modules/m15-creatomate/public";
import { applySucceededRenderByExternalId } from "@/modules/m15-creatomate/server";

// UUID match: Creatomate render IDs sono UUID v4. Rifiutiamo qualsiasi
// altro formato PRIMA di usarli in URL/DB (path injection su outbound).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Prova che la nostra org "possiede" questo external_id: verifica l'audit
// trail. Quando creiamo un render, logAuditEvent registra
// creatomate.default_render_started / _render_started / _render_orphaned
// con details.externalId. La recovery è concessa solo se un evento con
// quell'externalId esiste PER QUESTA organization.
async function ownsExternalId(organizationId: string, externalId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data } = await admin
    .from("audit_events")
    .select("id")
    .eq("organization_id", organizationId)
    .in("action", [
      "creatomate.render_started",
      "creatomate.default_render_started",
      "creatomate.default_render_orphaned",
      "creatomate.render_errored_possibly_charged",
      "creatomate.default_render_errored_possibly_charged",
    ])
    .filter("details->>externalId", "eq", externalId)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

export async function POST(req: Request) {
  const session = await getSessionOrRedirect();
  // Recovery è un'operazione amministrativa (crea row con externalId
  // fornito dal client): Owner-only.
  if (session.role !== "owner") {
    return NextResponse.json({ ok: false, error: "Solo Owner." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body non valido." }, { status: 400 });
  }
  const b = body as { externalId?: unknown; brandId?: unknown; draftId?: unknown };
  const rawExternalId = typeof b.externalId === "string" ? b.externalId : "";
  if (!UUID_RE.test(rawExternalId)) {
    return NextResponse.json(
      { ok: false, error: "externalId non valido (deve essere un UUID)." },
      { status: 400 },
    );
  }
  if (typeof b.brandId !== "string" || !b.brandId) {
    return NextResponse.json({ ok: false, error: "brandId mancante." }, { status: 400 });
  }
  const externalId = rawExternalId.toLowerCase();

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

  // Cross-tenant ownership: solo externalId tracciati in audit per QUESTA org.
  // Previene che un Owner di un'org altrui recuperi un render di un'altra.
  const owns = await ownsExternalId(session.organizationId, externalId);
  if (!owns) {
    return NextResponse.json(
      { ok: false, error: "externalId non trovato nel registro attività di questa organizzazione." },
      { status: 404 },
    );
  }

  // Già presente? Cerca scoped per org (getRenderByExternalId non filtra).
  const existing = await getRenderByExternalId(externalId);
  if (existing) {
    // Verifica che la row esistente appartenga alla nostra org: in caso
    // contrario trattalo come not-found generico (no info disclosure).
    if (existing.organizationId !== session.organizationId) {
      return NextResponse.json(
        { ok: false, error: "Render non recuperabile." },
        { status: 404 },
      );
    }
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
    live = await getRender(externalId);
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
      externalId: externalId,
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
      details: { externalId: externalId, status: initialStatus, ...(draftId ? { draftId } : {}) },
    });

    // Se è succeeded, fai il download+attach SUBITO
    if (initialStatus === "succeeded") {
      const applied = await applySucceededRenderByExternalId(externalId);
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
