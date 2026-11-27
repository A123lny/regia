"use server";

// Trova e recupera i render Creatomate orfani: external_id che hanno un
// audit event di start/orphaned per questa org MA non hanno una riga in
// creatomate_renders (insert fallito al momento dello start, es. migration
// non ancora applicata). Owner-only.
//
// Fonti di brandId/draftId per l'orfano, in ordine di preferenza:
//  1. audit event details (per i render avviati DOPO che abbiamo iniziato a
//     salvarli nell'audit - commit "Blocco B")
//  2. metadata di Creatomate (GET /v2/renders/:id → metadata JSON string,
//     recupera brandId/brandSlug/draftId dal payload inviato in sede di
//     createRender)
//  3. scelta manuale dall'UI (brand picker per i super-vecchi orfani)

import { randomBytes } from "node:crypto";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
import { logAuditEvent } from "@/lib/audit/log";
import { getRender } from "@/lib/creatomate/client";
import { getRenderByExternalId, insertCreatomateRender } from "@/modules/m15-creatomate/public";
import { applySucceededRenderByExternalId } from "@/modules/m15-creatomate/server";
import { getBrandById, listBrands } from "@/modules/m02-brand/public";
import { getContentDraft } from "@/modules/m03-editorial/public";

export type OrphanRow = {
  externalId: string;
  brandId: string | null;
  draftId: string | null;
  startedAt: string;
  action: string;
  /** "audit" quando brandId viene dall'audit event; "creatomate" quando dal
   * metadata recuperato via API; "none" quando non si è riusciti e serve
   * l'intervento manuale (brand picker). */
  brandSource: "audit" | "creatomate" | "none";
};

export type OrphanBrand = { id: string; slug: string; displayName: string };

export type FindOrphansResult =
  { ok: true; items: OrphanRow[]; brands: OrphanBrand[] } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prova a ricavare brandId/draftId leggendo i metadata che Creatomate ha
 * conservato per questo render (noi li abbiamo passati in createRender).
 * Best-effort: silenzioso su errore.
 */
async function fetchBrandFromCreatomateMetadata(extId: string): Promise<{
  brandId: string | null;
  draftId: string | null;
}> {
  try {
    const live = await getRender(extId);
    const raw = live.metadata;
    // metadata è stringa JSON (noi la stringifichiamo in createRender). Parse.
    let obj: unknown = null;
    if (typeof raw === "string") {
      try {
        obj = JSON.parse(raw);
      } catch {
        obj = null;
      }
    } else if (raw && typeof raw === "object") {
      obj = raw;
    }
    if (!obj || typeof obj !== "object") return { brandId: null, draftId: null };
    const o = obj as { brandId?: unknown; draftId?: unknown };
    return {
      brandId: typeof o.brandId === "string" ? o.brandId : null,
      draftId: typeof o.draftId === "string" ? o.draftId : null,
    };
  } catch {
    return { brandId: null, draftId: null };
  }
}

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
    const candidates: Array<{
      extId: string;
      brandId: string | null;
      draftId: string | null;
      startedAt: string;
      action: string;
    }> = [];
    for (const ev of (events ?? []) as Array<{
      action: string;
      details: unknown;
      created_at: string;
    }>) {
      const d = ev.details as { externalId?: unknown; brandId?: unknown; draftId?: unknown } | null;
      const extId = typeof d?.externalId === "string" ? d.externalId : "";
      if (!extId || seen.has(extId)) continue;
      seen.add(extId);
      const row = await getRenderByExternalId(extId);
      if (row && row.organizationId === session.organizationId) continue;
      candidates.push({
        extId,
        brandId: typeof d?.brandId === "string" ? d.brandId : null,
        draftId: typeof d?.draftId === "string" ? d.draftId : null,
        startedAt: ev.created_at,
        action: ev.action,
      });
    }

    // Per gli orfani senza brandId nell'audit (vecchi commit), prova a
    // ricavarlo dai metadata di Creatomate. Cap a 5 lookup per non far
    // esplodere i tempi della diagnostica (ogni getRender può prendere
    // anche 10s).
    const MAX_CREATOMATE_LOOKUPS = 5;
    let lookups = 0;
    const orphans: OrphanRow[] = [];
    for (const c of candidates) {
      let brandId: string | null = c.brandId;
      let draftId: string | null = c.draftId;
      let brandSource: OrphanRow["brandSource"] = brandId ? "audit" : "none";
      if (!brandId && lookups < MAX_CREATOMATE_LOOKUPS) {
        lookups++;
        const meta = await fetchBrandFromCreatomateMetadata(c.extId);
        if (meta.brandId) {
          brandId = meta.brandId;
          if (!draftId) draftId = meta.draftId;
          brandSource = "creatomate";
        }
      }
      orphans.push({
        externalId: c.extId,
        brandId,
        draftId,
        startedAt: c.startedAt,
        action: c.action,
        brandSource,
      });
    }

    // Lista brand dell'org per l'eventuale brand picker manuale.
    const brands = (await listBrands(session.organizationId, "active")).map((b) => ({
      id: b.id,
      slug: b.slug,
      displayName: b.displayName,
    }));

    return { ok: true, items: orphans, brands };
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
// orfano. brandId/draftId sono validati contro l'org SEMPRE, sia che arrivino
// dall'audit, dai metadata Creatomate, o dalla scelta manuale dell'utente.
async function recoverSingleOrphan(
  session: { userId: string; organizationId: string; role: string },
  args: { externalId: string; brandId: string; draftId: string | null },
): Promise<{ ok: true; renderId: string; status: string } | { ok: false; error: string }> {
  if (!UUID_RE.test(args.externalId)) {
    return { ok: false, error: "externalId non valido." };
  }
  if (!args.brandId) return { ok: false, error: "brandId mancante." };

  const extId = args.externalId.toLowerCase();

  // Row esistente? Se org diversa, not-found generico (no leak).
  const existing = await getRenderByExternalId(extId);
  if (existing) {
    if (existing.organizationId !== session.organizationId) {
      return { ok: false, error: "Render non trovato." };
    }
    return { ok: true, renderId: existing.id, status: existing.status };
  }

  // Brand deve appartenere a questa org.
  const brand = await getBrandById(session.organizationId, args.brandId);
  if (!brand) return { ok: false, error: "Brand non trovato nell'organizzazione." };

  // Draft (se citato) deve appartenere a questa org e a questo brand.
  if (args.draftId) {
    const draft = await getContentDraft(args.draftId, session.organizationId);
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
      ...(args.draftId ? { draftId: args.draftId } : {}),
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
      details: {
        externalId: extId,
        brandId: brand.id,
        brandSlug: brand.slug,
        ...(args.draftId ? { draftId: args.draftId } : {}),
        status: initialStatus,
      },
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
 * Recupera TUTTI gli orfani per cui è noto il brand (dall'audit o dai metadata
 * Creatomate). Quelli senza brand richiedono scelta manuale → vedi
 * recoverOrphanWithBrandAction.
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
      details.push({
        externalId: o.externalId,
        result: "brand non ricavabile - serve scelta manuale",
      });
      continue;
    }
    const r = await recoverSingleOrphan(session, {
      externalId: o.externalId,
      brandId: o.brandId,
      draftId: o.draftId,
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

/**
 * Recupero manuale di un singolo orfano quando il brand va scelto a mano
 * (orfani super-vecchi senza metadata recuperabili). brandId viene dal client
 * MA sia brandId che externalId sono validati contro l'org PRIMA di toccare
 * qualunque risorsa:
 *  - externalId: deve comparire in un audit event di questa org con action
 *    in set di start/orphaned. Senza questo check un utente potrebbe passare
 *    l'externalId di un altro tenant con il PROPRIO brandId e importarlo
 *    (cross-tenant resource claim).
 *  - brandId: la UI dropdown mostra solo brand dell'org, e getBrandById
 *    (session.orgId, brandId) interno a recoverSingleOrphan rigetta brand
 *    di altre org.
 */
export async function recoverOrphanWithBrandAction(input: {
  externalId: string;
  brandId: string;
  draftId?: string;
}): Promise<{ ok: true; renderId: string; status: string } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  if (session.role !== "owner") return { ok: false, error: "Solo Owner." };
  if (!UUID_RE.test(input.externalId)) return { ok: false, error: "externalId non valido." };

  // Audit ownership: deve esistere almeno un audit event di questa org che
  // referenzia questo externalId con un'azione di start/orphaned. Senza,
  // negare (not-found generico: no leak di esistenza su altra org).
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getAdminClient() as any;
    const { data: ev, error } = await admin
      .from("audit_events")
      .select("id")
      .eq("organization_id", session.organizationId)
      .in("action", [
        "creatomate.render_started",
        "creatomate.default_render_started",
        "creatomate.default_render_orphaned",
      ])
      .contains("details", { externalId: input.externalId })
      .limit(1)
      .maybeSingle();
    if (error || !ev) {
      return { ok: false, error: "Render non trovato fra gli orfani di questa organizzazione." };
    }
  } catch {
    return { ok: false, error: "Verifica audit fallita." };
  }

  return recoverSingleOrphan(session, {
    externalId: input.externalId,
    brandId: input.brandId,
    draftId: input.draftId ?? null,
  });
}
