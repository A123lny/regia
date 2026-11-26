"use server";

// Server actions fal.ai video image-to-video.
// 1) startFalVideoAction({draftId}) → avvia job queue, salva row, ritorna jobId
// 2) getFalVideoJobStatusAction({jobId}) → polling: se completato, scarica
//    il video, salva in bucket come brand_media_asset, allega alla bozza.

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import {
  assertAiEnabled,
  AiKillSwitchError,
  assertBudgetOk,
  AiBudgetExceededError,
  logSpend,
} from "@/modules/m11-admin/public";
import { getBrandById } from "@/modules/m02-brand/public";
import { getContentDraft } from "@/modules/m03-editorial/public";
import { getAdminClient } from "@/lib/db/admin";
import { getMediaAssetById } from "./media-assets-repo";
import { insertMediaAsset, setDraftMediaAsset } from "./media-assets-repo";
import { getActiveProviderBySlug } from "./media-providers-repo";
import {
  insertFalVideoJob,
  getFalVideoJobById,
  updateFalVideoJobStatus,
} from "./fal-video-repo";
import {
  submitVideoJob,
  getVideoJobStatus,
} from "@/lib/ai/fal-video";
import {
  FAL_VIDEO_MODEL,
  FAL_VIDEO_COST_USD,
  FAL_PROVIDER_SLUG,
} from "@/lib/ai/fal-config";
import {
  FalConfigError,
  FalApiError,
  FalRateLimitError,
  isFalKeyPresent,
} from "@/lib/ai/fal";

const BUCKET = "content-media";

export type StartVideoResult =
  | { ok: true; jobId: string; requestId: string }
  | { ok: false; error: string };

export type VideoStatusResult =
  | {
      ok: true;
      jobId: string;
      status: "queued" | "in_progress" | "succeeded" | "failed";
      outputUrl: string | null;
      assetId: string | null;
      errorMessage: string | null;
    }
  | { ok: false; error: string };

function mapErr(err: unknown): string {
  if (err instanceof FalConfigError) return err.message;
  if (err instanceof FalRateLimitError) return err.message;
  if (err instanceof FalApiError) return err.message;
  if (err instanceof AiKillSwitchError) return err.message;
  if (err instanceof AiBudgetExceededError) return err.message;
  if (err instanceof Error) return err.message;
  return "Errore sconosciuto.";
}

async function preflight(
  organizationId: string,
  estimatedCost: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isFalKeyPresent()) {
    return {
      ok: false,
      error: "Chiave fal.ai non impostata (FAL_KEY).",
    };
  }
  try {
    await assertAiEnabled(organizationId);
  } catch (err) {
    if (err instanceof AiKillSwitchError) return { ok: false, error: err.message };
    throw err;
  }
  try {
    await assertBudgetOk(organizationId, "fal", estimatedCost);
  } catch (err) {
    if (err instanceof AiBudgetExceededError) return { ok: false, error: err.message };
    throw err;
  }
  const provider = await getActiveProviderBySlug(organizationId, FAL_PROVIDER_SLUG);
  if (!provider) {
    return {
      ok: false,
      error: "Provider fal.ai non attivo (Impostazioni → Provider media).",
    };
  }
  if (!provider.allowedUses.includes("commercial")) {
    return {
      ok: false,
      error: "Il provider fal.ai non ha 'Commerciale' tra gli usi consentiti.",
    };
  }
  return { ok: true };
}

export async function startFalVideoAction(input: {
  brandId: string;
  draftId: string;
  prompt?: string;
  durationSeconds?: number;
}): Promise<StartVideoResult> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "content.generate");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }

  const brand = await getBrandById(session.organizationId, input.brandId);
  if (!brand) return { ok: false, error: "Marchio non trovato." };

  const draft = await getContentDraft(input.draftId, session.organizationId);
  if (!draft) return { ok: false, error: "Bozza non trovata." };
  if (draft.brandId !== brand.id) {
    return { ok: false, error: "La bozza non appartiene a questo marchio." };
  }
  if (!draft.mediaAssetId) {
    return {
      ok: false,
      error: "Serve un'immagine allegata alla bozza. Genera o allega prima un'immagine.",
    };
  }
  const asset = await getMediaAssetById(session.organizationId, draft.mediaAssetId);
  if (!asset) {
    return { ok: false, error: "Immagine della bozza non trovata nella libreria." };
  }

  const pre = await preflight(session.organizationId, FAL_VIDEO_COST_USD);
  if (!pre.ok) return pre;

  const prompt =
    (input.prompt && input.prompt.trim().length > 0
      ? input.prompt.trim()
      : [
          `Cinematic animation for ${brand.displayName}, social media Story.`,
          draft.generatedText.slice(0, 300),
          "Slow zoom, soft camera movement, natural lighting. No text overlay.",
        ].join(" ")
    ).slice(0, 2000);

  let submit;
  try {
    submit = await submitVideoJob({
      imageUrl: asset.signedUrl,
      prompt,
      ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {}),
      aspectRatio: "9:16",
    });
  } catch (err) {
    console.error("[fal-video] submit failed", {
      brandSlug: brand.slug,
      draftId: input.draftId,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: mapErr(err) };
  }

  // Log spesa + audit SUBITO (parità con fal images)
  try {
    await logSpend({
      organizationId: session.organizationId,
      brandId: brand.id,
      category: "fal",
      action: "media.ai_video_submitted",
      costUsd: submit.estimatedCostUsd,
      tokensIn: 0,
      tokensOut: 0,
      targetType: "draft",
      targetId: input.draftId,
    });
  } catch {
    // best-effort
  }

  const job = await insertFalVideoJob({
    organizationId: session.organizationId,
    brandId: brand.id,
    draftId: input.draftId,
    requestId: submit.requestId,
    modelId: FAL_VIDEO_MODEL,
    prompt,
    imageUrl: asset.signedUrl,
    requestedBy: session.userId,
  });

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "media.ai_video_submitted",
    target: `draft:${input.draftId}`,
    details: {
      provider: "fal.ai",
      model: FAL_VIDEO_MODEL,
      requestId: submit.requestId,
      estimatedCostUsd: submit.estimatedCostUsd,
    },
  });

  return { ok: true, jobId: job.id, requestId: submit.requestId };
}

export async function getFalVideoJobStatusAction(input: {
  jobId: string;
}): Promise<VideoStatusResult> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "content.generate");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }
  const job = await getFalVideoJobById(input.jobId, session.organizationId);
  if (!job) return { ok: false, error: "Job non trovato." };

  if (job.status === "succeeded" || job.status === "failed") {
    return {
      ok: true,
      jobId: job.id,
      status: job.status,
      outputUrl: job.outputUrl,
      assetId: job.assetId,
      errorMessage: job.errorMessage,
    };
  }

  // Poll fal
  let s;
  try {
    s = await getVideoJobStatus(job.requestId);
  } catch (err) {
    return { ok: false, error: mapErr(err) };
  }

  if (s.status === "succeeded") {
    // Download + save
    let asset;
    try {
      asset = await downloadAndSaveVideo({
        videoUrl: s.videoUrl,
        organizationId: job.organizationId,
        brandId: job.brandId,
        caption: `[AI video] ${job.prompt.slice(0, 100)}`,
        tags: ["ai-generated", "fal-ai", "video"],
        uploadedBy: job.requestedBy,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore salvataggio video.";
      await updateFalVideoJobStatus({
        jobId: job.id,
        status: "failed",
        errorMessage: msg,
      });
      return {
        ok: true,
        jobId: job.id,
        status: "failed",
        outputUrl: null,
        assetId: null,
        errorMessage: msg,
      };
    }
    if (job.draftId) {
      try {
        await setDraftMediaAsset(session.organizationId, job.draftId, asset.id);
      } catch {
        // non blocca
      }
    }
    await updateFalVideoJobStatus({
      jobId: job.id,
      status: "succeeded",
      outputUrl: s.videoUrl,
      durationSeconds: s.durationSeconds ?? null,
      assetId: asset.id,
    });
    if (job.draftId) revalidatePath(`/contenuti`);
    return {
      ok: true,
      jobId: job.id,
      status: "succeeded",
      outputUrl: s.videoUrl,
      assetId: asset.id,
      errorMessage: null,
    };
  }
  if (s.status === "failed") {
    await updateFalVideoJobStatus({
      jobId: job.id,
      status: "failed",
      errorMessage: s.errorMessage,
    });
    return {
      ok: true,
      jobId: job.id,
      status: "failed",
      outputUrl: null,
      assetId: null,
      errorMessage: s.errorMessage,
    };
  }
  // in_progress o queued
  if (s.status !== job.status) {
    await updateFalVideoJobStatus({ jobId: job.id, status: s.status });
  }
  return {
    ok: true,
    jobId: job.id,
    status: s.status,
    outputUrl: null,
    assetId: null,
    errorMessage: null,
  };
}

async function downloadAndSaveVideo(input: {
  videoUrl: string;
  organizationId: string;
  brandId: string;
  caption: string;
  tags: string[];
  uploadedBy: string;
}) {
  const res = await fetch(input.videoUrl, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`Download video fal fallito (${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 100 * 1024 * 1024) {
    throw new Error("Video troppo grande (>100MB).");
  }
  const assetId = randomUUID();
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const storagePath = `media/${input.organizationId}/${input.brandId}/${yyyy}/${mm}/${assetId}.mp4`;

  const admin = getAdminClient();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: "video/mp4", upsert: false });
  if (upErr) throw new Error(`Upload fal video fallito: ${upErr.message}`);
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
  if (signErr || !signed) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new Error("URL firmato video non disponibile.");
  }
  return insertMediaAsset({
    organizationId: input.organizationId,
    brandId: input.brandId,
    storagePath,
    signedUrl: signed.signedUrl,
    contentType: "video/mp4",
    sizeBytes: buf.byteLength,
    width: null,
    height: null,
    tags: input.tags,
    caption: input.caption.slice(0, 500),
    uploadedBy: input.uploadedBy,
  });
}
