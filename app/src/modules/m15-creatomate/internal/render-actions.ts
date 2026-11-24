"use server";

// M15 — Server actions Creatomate.
// startRender: capability + preflight (kill switch, budget, provider attivo),
// chiama Creatomate, salva riga queued, ritorna {renderId, externalId}.
// Il webhook (vedi webhook-handler) chiude il flusso quando il render è pronto.

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { assertAiEnabled, AiKillSwitchError } from "@/modules/m11-admin/public";
import { assertBudgetOk, AiBudgetExceededError, logSpend } from "@/modules/m11-admin/public";
import { getBrandById } from "@/modules/m02-brand/public";
import { setDraftMediaAsset } from "@/modules/m04-media/public";
import {
  createRender,
  getRender,
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
import {
  insertCreatomateRender,
  updateRenderStatus,
  getRenderById,
} from "./creatomate-renders-repo";
import { downloadAndSaveCreatomateOutput } from "./save-output";

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

/**
 * Avvia un render Creatomate. Ritorna {renderId, externalId} subito,
 * senza aspettare il completamento.
 */
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

  const brand = await getBrandById(session.organizationId, input.brandId);
  if (!brand) return { ok: false, error: "Marchio non trovato." };

  const quality: CreatomateRenderQuality = input.quality ?? "test";
  const preset = CREATOMATE_PRESETS[quality];
  const estimatedUsd = preset.estimatedCredits * CREATOMATE_USD_PER_CREDIT;

  const pre = await preflight(session.organizationId, estimatedUsd);
  if (!pre.ok) return pre;

  const appUrl =
    process.env["NEXT_PUBLIC_APP_URL"]?.replace(/\/$/, "") ??
    (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "");
  if (!appUrl) {
    return {
      ok: false,
      error:
        "URL app non configurato (manca NEXT_PUBLIC_APP_URL): impossibile ricevere il webhook di Creatomate.",
    };
  }

  const webhookToken = randomBytes(24).toString("hex");
  const webhookUrl = `${appUrl}/api/creatomate/webhook?t=${webhookToken}`;

  try {
    const r = await createRender({
      templateId: input.templateId,
      modifications: input.modifications,
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

    const row = await insertCreatomateRender({
      organizationId: session.organizationId,
      brandId: brand.id,
      ...(input.draftId ? { draftId: input.draftId } : {}),
      externalId: r.id,
      templateId: input.templateId,
      modifications: input.modifications,
      webhookToken,
      requestedBy: session.userId,
      initialStatus: (r.status as never) ?? "queued",
    });

    // Budget: stimiamo ora la spesa. Reale invariante vs crediti consumati =
    // manuale su dashboard Creatomate. Il logSpend è best-effort (pattern fal).
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
        renderId: row.id,
        err: logErr instanceof Error ? logErr.message : String(logErr),
      });
    }

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "creatomate.render_started",
      target: `render:${row.id}`,
      details: {
        provider: "creatomate",
        templateId: input.templateId,
        externalId: r.id,
        quality,
        estimatedCredits: preset.estimatedCredits,
        estimatedCostUsd: estimatedUsd,
      },
    });

    return { ok: true, renderId: row.id, externalId: r.id, status: row.status };
  } catch (err) {
    console.error("[creatomate] startCreatomateRender failed", {
      brandSlug: brand.slug,
      templateId: input.templateId,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: mapCreatomateError(err) };
  }
}

/**
 * Polling di fallback. Usato dalla UI quando il webhook è bloccato (dev
 * locale senza tunnel) o quando l'utente ricarica la pagina.
 * Se il render risulta completato lato Creatomate ma il nostro DB è ancora
 * su pending, chiude il flusso (scarica output, crea asset, aggiorna riga).
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

  // Già in stato finale: ritorna da DB, nessuna chiamata esterna.
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

  // Poll lato Creatomate.
  try {
    const live = await getRender(row.externalId);
    const mapped = mapLiveStatus(live.status);
    if (mapped === "succeeded" && live.url) {
      const saved = await applySucceededRender(row.id, {
        organizationId: session.organizationId,
        brandId: row.brandId,
        draftId: row.draftId,
        externalId: row.externalId,
        outputUrl: live.url,
        snapshotUrl: live.snapshot_url ?? null,
        outputFormat: live.output_format ?? null,
        width: live.width ?? null,
        height: live.height ?? null,
        durationSeconds: live.duration ?? null,
        uploadedBy: session.userId,
      });
      return {
        ok: true,
        renderId: row.id,
        status: "succeeded",
        outputUrl: live.url,
        snapshotUrl: live.snapshot_url ?? null,
        assetId: saved.assetId,
        errorMessage: null,
      };
    }
    if (mapped === "failed") {
      const errMsg = live.error_message ?? "Render Creatomate fallito senza dettaglio.";
      await updateRenderStatus({
        externalId: row.externalId,
        status: "failed",
        errorMessage: errMsg,
      });
      return {
        ok: true,
        renderId: row.id,
        status: "failed",
        outputUrl: null,
        snapshotUrl: null,
        assetId: null,
        errorMessage: errMsg,
      };
    }
    // Ancora in corso: aggiorno solo lo status se è cambiato.
    if (mapped !== row.status) {
      await updateRenderStatus({ externalId: row.externalId, status: mapped });
    }
    return {
      ok: true,
      renderId: row.id,
      status: mapped,
      outputUrl: row.outputUrl,
      snapshotUrl: row.snapshotUrl,
      assetId: row.assetId,
      errorMessage: null,
    };
  } catch (err) {
    console.error("[creatomate] getCreatomateRenderStatus failed", {
      renderId: row.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: mapCreatomateError(err) };
  }
}

function mapLiveStatus(s: string): "queued" | "planned" | "rendering" | "succeeded" | "failed" {
  if (s === "succeeded") return "succeeded";
  if (s === "failed" || s === "cancelled") return "failed";
  if (s === "planned") return "planned";
  if (s === "rendering" || s === "transcribing") return "rendering";
  return "queued";
}

/**
 * Esposta anche al webhook-handler. Scarica l'output, crea il brand_media_asset,
 * aggancia alla bozza se collegata, aggiorna la riga render a succeeded.
 */
export async function applySucceededRender(
  renderRowId: string,
  input: {
    organizationId: string;
    brandId: string;
    draftId: string | null;
    externalId: string;
    outputUrl: string;
    snapshotUrl: string | null;
    outputFormat: string | null;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
    uploadedBy: string;
  },
): Promise<{ assetId: string }> {
  const asset = await downloadAndSaveCreatomateOutput({
    outputUrl: input.outputUrl,
    organizationId: input.organizationId,
    brandId: input.brandId,
    caption: `[Creatomate] render ${input.externalId.slice(0, 8)}`,
    tags: ["creatomate", "ai-generated", input.outputFormat ?? "video"],
    uploadedBy: input.uploadedBy,
  });

  if (input.draftId) {
    try {
      await setDraftMediaAsset(input.organizationId, input.draftId, asset.id);
    } catch (err) {
      console.error("[creatomate] setDraftMediaAsset failed", {
        renderRowId,
        draftId: input.draftId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await updateRenderStatus({
    externalId: input.externalId,
    status: "succeeded",
    outputUrl: input.outputUrl,
    snapshotUrl: input.snapshotUrl,
    outputFormat: input.outputFormat,
    width: input.width,
    height: input.height,
    durationSeconds: input.durationSeconds,
    assetId: asset.id,
  });

  await logAuditEvent({
    organizationId: input.organizationId,
    actorUserId: input.uploadedBy,
    actorKind: "system",
    action: "creatomate.render_succeeded",
    target: `render:${renderRowId}`,
    details: {
      provider: "creatomate",
      externalId: input.externalId,
      assetId: asset.id,
      outputFormat: input.outputFormat,
      width: input.width,
      height: input.height,
      durationSeconds: input.durationSeconds,
    },
  });

  if (input.draftId) {
    revalidatePath(`/contenuti`);
  }

  return { assetId: asset.id };
}
