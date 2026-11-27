"use server";

// Trova e recupera i render Creatomate orfani: external_id che hanno un
// audit event di start/orphaned per questa org MA non hanno una riga in
// creatomate_renders (insert fallito al momento dello start, es. migration
// non ancora applicata). Un click → tutti recuperati, Owner-only.

import { randomBytes } from "node:crypto";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
import { logAuditEvent } from "@/lib/audit/log";
import { getRender } from "@/lib/creatomate/client";
import { getRenderByExternalId, insertCreatomateRender } from "@/modules/m15-creatomate/public";
import { applySucceededRenderByExternalId } from "@/modules/m15-creatomate/server";
import { getBrandById } from "@/modules/m02-brand/public";
import { getContentDraft } from "@/modules/m03-editorial/public";

export type OrphanRow = {
  externalId: string;
  brandId: string | null;
  draftId: string | null;
  startedAt: string;
  action: string;
};

export type FindOrphansResult = { ok: true; items: OrphanRow[] } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function findOrphanCreatomateRendersAction(): Promise<FindOrphansResult> {
  const session = await getSessionOrRedirect();
  if (session.role !== "owner") return { ok: false, error: "Solo Owner." };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getAdminClient() as any;
    const { data: events, error } = await admin
      .from("audit_events")
      .select("action, details, created_at")
      .eq("organization_id", session.organizationId)
      .in("action", [
        "creatomate.render_started",
        "creatomate.default_render_started",
        "creatomate.default_render_orphaned",
      ])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { ok: false, error: error.message };
    const seen = new Set<string>();
    const orphans: OrphanRow[] = [];
    for (const ev of (events ?? []) as Array<{
      action: string;
      details: unknown;
      created_at: string;
    }>) {
      const d = ev.details as { externalId?: unknown; brandId?: unknown; draftId?: unknown } | null;
      const extId = typeof d?.externalId === "string" ? d.externalId : "";
      if (!extId || seen.has(extId)) continue;
      seen.add(extId);
      // Esiste già in DB? allora non è orfano
      const row = await getRenderByExternalId(extId);
      if (row && row.organizationId === session.organizationId) continue;
      orphans.push({
        externalId: extId,
        brandId: typeof d?.brandId === "string" ? d.brandId : null,
        draftId: typeof d?.draftId === "string" ? d.draftId : null,
        startedAt: ev.created_at,
        action: ev.action,
      });
    }
    return { ok: true, items: orphans };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "errore" };
  }
}

export type RecoverResult =
  | {
      ok: true;
      recovered: number;
      failed: number;
      details: Array<{ externalId: string; result: string }>;
    }
  | { ok: false; error: string };

// Helper interno (NON "server action" esposta al client): recupera un singolo
// orfano partendo da una OrphanRow già derivata lato server dall'audit event
// di questa org. brandId/draftId NON vengono mai dal client. Chiamato solo da
// recoverAllOrphansAction qui sotto.
//
// Ownership checks (defense-in-depth):
//  1. externalId: audit ownership è già garantita da findOrphans (eq
//     organization_id). Validiamo UUID.
//  2. brandId: deve esistere nell'org tramite getBrandById (IDOR su brand).
//  3. draftId (se presente): deve esistere nell'org E appartenere allo
//     stesso brand (IDOR su draft, draft→brand mismatch).
//  4. row esistente: se c'è già una riga con questo external_id ma org
//     diversa, non ricreiamo nulla (externalId globale in Creatomate — una
//     collisione cross-tenant significa che qualcun altro l'ha già importato).
async function recoverSingleOrphan(
  session: { userId: string; organizationId: string; role: string },
  orphan: OrphanRow,
): Promise<{ ok: true; renderId: string; status: string } | { ok: false; error: string }> {
  if (!UUID_RE.test(orphan.externalId)) {
    return { ok: false, error: "externalId non valido." };
  }
  if (!orphan.brandId) return { ok: false, error: "brandId mancante in audit." };

  const extId = orphan.externalId.toLowerCase();

  // Row esistente? Se org diversa, trattiamo come not-found generico (no leak).
  const existing = await getRenderByExternalId(extId);
  if (existing) {
    if (existing.organizationId !== session.organizationId) {
      return { ok: false, error: "Render non trovato." };
    }
    return { ok: true, renderId: existing.id, status: existing.status };
  }

  // Brand deve appartenere a questa org.
  const brand = await getBrandById(session.organizationId, orphan.brandId);
  if (!brand) return { ok: false, error: "Brand non trovato nell'organizzazione." };

  // Draft (se citato) deve appartenere a questa org e a questo brand.
  if (orphan.draftId) {
    const draft = await getContentDraft(orphan.draftId, session.organizationId);
    if (!draft) return { ok: false, error: "Bozza collegata non trovata." };
    if (draft.brandId !== brand.id) {
      return { ok: false, error: "Bozza non appartiene al brand indicato." };
    }
  }

  let live;
  try {
    live = await getRender(extId);
  } catch (err) {
    return {
      ok: false,
      error: `Creatomate: ${err instanceof Error ? err.message : "errore"}`,
    };
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

  try {
    const row = await insertCreatomateRender({
      organizationId: session.organizationId,
      brandId: brand.id,
      ...(orphan.draftId ? { draftId: orphan.draftId } : {}),
      externalId: extId,
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
      details: { externalId: extId, status: initialStatus },
    });
    if (initialStatus === "succeeded") {
      const applied = await applySucceededRenderByExternalId(extId);
      return {
        ok: true,
        renderId: row.id,
        status: applied.ok
          ? "succeeded (asset in libreria)"
          : `succeeded (apply error: ${applied.ok === false ? applied.error : "?"})`,
      };
    }
    return { ok: true, renderId: row.id, status: initialStatus };
  } catch (err) {
    return { ok: false, error: `Insert DB: ${err instanceof Error ? err.message : "errore"}` };
  }
}

/**
 * Recupera TUTTI gli orfani trovati. Owner-only. brandId/draftId vengono
 * sempre dall'audit event di questa org, mai dal client.
 */
export async function recoverAllOrphansAction(): Promise<RecoverResult> {
  const session = await getSessionOrRedirect();
  if (session.role !== "owner") return { ok: false, error: "Solo Owner." };
  const found = await findOrphanCreatomateRendersAction();
  if (!found.ok) return { ok: false, error: found.error };
  let recovered = 0;
  let failed = 0;
  const details: Array<{ externalId: string; result: string }> = [];
  for (const o of found.items) {
    const r = await recoverSingleOrphan(session, o);
    if (r.ok) {
      recovered++;
      details.push({ externalId: o.externalId, result: r.status });
    } else {
      failed++;
      details.push({ externalId: o.externalId, result: r.error });
    }
  }
  return { ok: true, recovered, failed, details };
}
