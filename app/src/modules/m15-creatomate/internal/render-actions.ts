"use server";

// M15 — Server actions pubbliche Creatomate.
// SOLO startCreatomateRender e getCreatomateRenderStatus sono esposte come
// server actions. applySucceededRenderByExternalId è in un file non-action
// (server-only) e viene richiamata dal webhook handler e dal polling.

import { randomBytes } from "node:crypto";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { assertAiEnabled, AiKillSwitchError } from "@/modules/m11-admin/public";
import { assertBudgetOk, AiBudgetExceededError, logSpend } from "@/modules/m11-admin/public";
import { getBrandById } from "@/modules/m02-brand/public";
import { getContentDraft } from "@/modules/m03-editorial/public";
import {
  createRender,
  CreatomateError,
  CreatomateConfigError,
  CreatomateCreditsExhaustedError,
  CreatomateRateLimitError,
  CreatomateTemplateNotFoundError,
  CreatomateValidationError,
} from "@/lib/creatomate/client";
import {
  CREATOMATE_PRESETS,
  CREATOMATE_PROVIDER_SLUG,
  CREATOMATE_USD_PER_CREDIT,
  type CreatomateRenderQuality,
} from "@/lib/creatomate/config";
import { getActiveProviderBySlug } from "@/modules/m04-media/internal/media-providers-repo";
import { insertCreatomateRender, getRenderById } from "./creatomate-renders-repo";
import { applySucceededRenderByExternalId } from "./apply-succeeded";

export type StartRenderResult =
  | { ok: true; renderId: string; externalId: string; status: string }
  | { ok: false; error: string };

export type RenderStatusResult =
  | {
      ok: true;
      renderId: string;
      status: string;
      outputUrl: string | null;
      snapshotUrl: string | null;
      assetId: string | null;
      errorMessage: string | null;
    }
  | { ok: false; error: string };

// ────────────────────────────────────────────────────────────────────────
// Validazione modifications: evitiamo che l'input nascosto influenzi
// qualità/dimensione (anti abuse sul cap crediti) e tagliamo valori lunghi.
// ────────────────────────────────────────────────────────────────────────
const BLOCKED_MOD_KEYS = new Set<string>([
  "width",
  "height",
  "frame_rate",
  "duration",
  "output_format",
]);
const MAX_MOD_KEYS = 40;
const MAX_MOD_VALUE_LEN = 2000;

function sanitizeModifications(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (n >= MAX_MOD_KEYS) break;
    if (typeof k !== "string" || k.length === 0 || k.length > 120) continue;
    if (BLOCKED_MOD_KEYS.has(k.toLowerCase())) continue;
    if (v === null || v === undefined) continue;
    const val = typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";
    if (!val) continue;
    out[k] = val.slice(0, MAX_MOD_VALUE_LEN);
    n++;
  }
  return out;
}

function isQuality(q: unknown): q is CreatomateRenderQuality {
  return q === "test" || q === "final";
}

function mapCreatomateError(err: unknown): string {
  if (err instanceof CreatomateConfigError) return err.message;
  if (err instanceof CreatomateCreditsExhaustedError) return err.message;
  if (err instanceof CreatomateRateLimitError) return err.message;
  if (err instanceof CreatomateTemplateNotFoundError) return err.message;
  if (err instanceof CreatomateValidationError) return err.message;
  if (err instanceof CreatomateError) return err.message;
  if (err instanceof AiKillSwitchError) return err.message;
  if (err instanceof AiBudgetExceededError) return err.message;
  if (err instanceof Error) return err.message;
  return "Errore sconosciuto in Creatomate.";
}

async function preflight(
  organizationId: string,
  estimatedCostUsd: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAiEnabled(organizationId);
  } catch (err) {
    if (err instanceof AiKillSwitchError) return { ok: false, error: err.message };
    throw err;
  }
  try {
    await assertBudgetOk(organizationId, "creatomate", estimatedCostUsd);
  } catch (err) {
    if (err instanceof AiBudgetExceededError) return { ok: false, error: err.message };
    throw err;
  }
  const provider = await getActiveProviderBySlug(organizationId, CREATOMATE_PROVIDER_SLUG);
  if (!provider) {
    return {
      ok: false,
      error:
        "Provider Creatomate non attivo in Impostazioni → Provider media (/impostazioni/provider-media). Registralo con slug \"creatomate\" e diritti d'uso \"commercial\" per generare visual.",
    };
  }
  if (!provider.allowedUses.includes("commercial")) {
    return {
      ok: false,
      error:
        "Il provider Creatomate non consente l'uso commerciale. Aggiorna gli 'Usi consentiti' in Impostazioni → Provider media.",
    };
  }
  return { ok: true };
}

export async function startCreatomateRender(input: {
  brandId: string;
  draftId?: string;
  templateId: string;
  modifications: Record<string, unknown>;
  quality?: CreatomateRenderQuality;
  outputFormat?: "mp4" | "jpg" | "png" | "gif" | "webp";
}): Promise<StartRenderResult> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "content.generate");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }

  if (typeof input.brandId !== "string" || !input.brandId) {
    return { ok: false, error: "brandId mancante." };
  }
  if (typeof input.templateId !== "string" || input.templateId.length < 4) {
    return { ok: false, error: "ID template non valido." };
  }
  if (typeof input.modifications !== "object" || !input.modifications) {
    return { ok: false, error: "Campi dinamici non validi." };
  }
  const quality: CreatomateRenderQuality = isQuality(input.quality) ? input.quality : "test";
  const preset = CREATOMATE_PRESETS[quality];
  const estimatedUsd = preset.estimatedCredits * CREATOMATE_USD_PER_CREDIT;

  const brand = await getBrandById(session.organizationId, input.brandId);
  if (!brand) return { ok: false, error: "Marchio non trovato." };

  // Ownership draft: se passato, deve essere della stessa org e dello
  // stesso brand del render.
  if (input.draftId) {
    const draft = await getContentDraft(input.draftId, session.organizationId);
    if (!draft) return { ok: false, error: "Bozza non trovata." };
    if (draft.brandId !== brand.id) {
      return { ok: false, error: "La bozza non appartiene a questo marchio." };
    }
  }

  const pre = await preflight(session.organizationId, estimatedUsd);
  if (!pre.ok) return pre;

  const appUrl =
    process.env["NEXT_PUBLIC_APP_URL"]?.replace(/\/$/, "") ??
    (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "");
  if (!appUrl) {
    return {
      ok: false,
      error:
        "URL app non configurato (NEXT_PUBLIC_APP_URL): impossibile ricevere il webhook di Creatomate.",
    };
  }

  const webhookToken = randomBytes(24).toString("hex");
  const webhookUrl = `${appUrl}/api/creatomate/webhook?t=${webhookToken}`;
  const modifications = sanitizeModifications(input.modifications);

  let r;
  try {
    r = await createRender({
      templateId: input.templateId,
      modifications,
      webhookUrl,
      metadata: {
        brandId: brand.id,
        brandSlug: brand.slug,
        ...(input.draftId ? { draftId: input.draftId } : {}),
        requestedBy: session.userId,
      },
      ...(input.outputFormat ? { outputFormat: input.outputFormat } : {}),
      ...(preset.width ? { width: preset.width } : {}),
      ...(preset.height ? { height: preset.height } : {}),
      ...(preset.frameRate ? { frameRate: preset.frameRate } : {}),
    });
  } catch (err) {
    console.error("[creatomate] startCreatomateRender failed", {
      brandSlug: brand.slug,
      templateId: input.templateId,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: mapCreatomateError(err) };
  }

  // Creatomate ha accettato la richiesta: ha quasi certamente addebitato i
  // crediti. Logghiamo la spesa SUBITO prima di qualunque altra operazione
  // DB che potrebbe fallire — pattern identico a fal.ai per evitare
  // spend-cap bypass.
  try {
    await logSpend({
      organizationId: session.organizationId,
      brandId: brand.id,
      category: "creatomate",
      action: "creatomate.render_started",
      costUsd: estimatedUsd,
      tokensIn: 0,
      tokensOut: 0,
      targetType: "draft",
      ...(input.draftId ? { targetId: input.draftId } : {}),
    });
  } catch (logErr) {
    console.error("[creatomate] logSpend start fail", {
      brandSlug: brand.slug,
      externalId: r.id,
      estimatedUsd,
      err: logErr instanceof Error ? logErr.message : String(logErr),
    });
  }
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "creatomate.render_started",
    target: `render:${r.id}`,
    details: {
      provider: "creatomate",
      templateId: input.templateId,
      externalId: r.id,
      quality,
      estimatedCredits: preset.estimatedCredits,
      estimatedCostUsd: estimatedUsd,
    },
  });

  // Mappa lo status restituito dalla POST creatomate ai nostri valori.
  const initialStatus =
    r.status === "succeeded"
      ? "succeeded"
      : r.status === "failed" || r.status === "cancelled"
        ? "failed"
        : r.status === "planned"
          ? "planned"
          : r.status === "rendering" || r.status === "transcribing"
            ? "rendering"
            : "queued";

  try {
    const row = await insertCreatomateRender({
      organizationId: session.organizationId,
      brandId: brand.id,
      ...(input.draftId ? { draftId: input.draftId } : {}),
      externalId: r.id,
      templateId: input.templateId,
      modifications,
      webhookToken,
      requestedBy: session.userId,
      initialStatus,
    });
    return { ok: true, renderId: row.id, externalId: r.id, status: row.status };
  } catch (err) {
    console.error("[creatomate] insertCreatomateRender failed (AFTER fal charge!)", {
      externalId: r.id,
      brandSlug: brand.slug,
      err: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      error:
        "Render avviato su Creatomate ma non salvato in locale. Spesa già registrata. Contatta il supporto citando ID: " +
        r.id,
    };
  }
}

/**
 * Polling: ritorna lo stato corrente. Se la riga è pending, poll Creatomate
 * e, se succeeded, chiama applySucceededRenderByExternalId (che fa claim
 * atomico, idempotente). URL/ownership derivati da DB+API, non da input.
 */
export async function getCreatomateRenderStatus(input: {
  renderId: string;
}): Promise<RenderStatusResult> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "content.generate");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }
  const row = await getRenderById(input.renderId, session.organizationId);
  if (!row) return { ok: false, error: "Render non trovato." };

  if (row.status === "succeeded" || row.status === "failed" || row.status === "cancelled") {
    return {
      ok: true,
      renderId: row.id,
      status: row.status,
      outputUrl: row.outputUrl,
      snapshotUrl: row.snapshotUrl,
      assetId: row.assetId,
      errorMessage: row.errorMessage,
    };
  }

  // In corso: tentiamo di chiudere via apply (che fa refetch autenticato).
  // Se applica → status aggiornato; se non ancora → riportiamo row originale.
  const applied = await applySucceededRenderByExternalId(row.externalId);
  const after = await getRenderById(input.renderId, session.organizationId);
  if (!after) return { ok: false, error: "Render non trovato (post refresh)." };

  // applied può essere errore senza che il render sia "failed" (es. non ancora
  // succeeded su Creatomate). Non tornarlo come errore all'UI: ritorna lo
  // status corrente.
  if (!applied.ok && after.status !== "failed") {
    return {
      ok: true,
      renderId: after.id,
      status: after.status,
      outputUrl: after.outputUrl,
      snapshotUrl: after.snapshotUrl,
      assetId: after.assetId,
      errorMessage: null,
    };
  }
  return {
    ok: true,
    renderId: after.id,
    status: after.status,
    outputUrl: after.outputUrl,
    snapshotUrl: after.snapshotUrl,
    assetId: after.assetId,
    errorMessage: after.errorMessage,
  };
}
