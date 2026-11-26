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
import {
  getRenderByExternalId,
  insertCreatomateRender,
} from "@/modules/m15-creatomate/public";
import { applySucceededRenderByExternalId } from "@/modules/m15-creatomate/server";

export type OrphanRow = {
  externalId: string;
  brandId: string | null;
  draftId: string | null;
  startedAt: string;
  action: string;
};

export type FindOrphansResult =
  | { ok: true; items: OrphanRow[] }
  | { ok: false; error: string };

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
  | { ok: true; recovered: number; failed: number; details: Array<{ externalId: string; result: string }> }
  | { ok: false; error: string };

/**
 * Recupera un singolo orfano: fetch da Creatomate + insert row + eventuale
 * download output se succeeded. Idempotente.
 */
export async function recoverSingleOrphanAction(input: {
  externalId: string;
  brandId: string;
  draftId?: string;
}): Promise<{ ok: true; renderId: string; status: string } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  if (session.role !== "owner") return { ok: false, error: "Solo Owner." };
  if (!UUID_RE.test(input.externalId)) {
    return { ok: false, error: "externalId non valido." };
  }
  if (!input.brandId) return { ok: false, error: "brandId mancante." };

  const extId = input.externalId.toLowerCase();

  // Già presente?
  const existing = await getRenderByExternalId(extId);
  if (existing && existing.organizationId === session.organizationId) {
    return { ok: true, renderId: existing.id, status: existing.status };
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
      brandId: input.brandId,
      ...(input.draftId ? { draftId: input.draftId } : {}),
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
        status: applied.ok ? "succeeded (asset in libreria)" : `succeeded (apply error: ${applied.ok === false ? applied.error : "?"})`,
      };
    }
    return { ok: true, renderId: row.id, status: initialStatus };
  } catch (err) {
    return { ok: false, error: `Insert DB: ${err instanceof Error ? err.message : "errore"}` };
  }
}

/**
 * Recupera TUTTI gli orfani trovati, usando la brandId indicata nell'audit.
 * Pensata per la UI "Recupera tutti" nel pannello diagnostica.
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
    if (!o.brandId) {
      failed++;
      details.push({ externalId: o.externalId, result: "brandId mancante in audit" });
      continue;
    }
    const r = await recoverSingleOrphanAction({
      externalId: o.externalId,
      brandId: o.brandId,
      ...(o.draftId ? { draftId: o.draftId } : {}),
    });
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
