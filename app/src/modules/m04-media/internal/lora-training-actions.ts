"use server";

// "Addestra stile" — LoRA training su fal (fal-ai/flux-lora-fast-training).
// Flusso:
//  1. UI client: utente seleziona 4-30 immagini dalla Libreria media.
//  2. Server: scarica ogni asset dal bucket content-media, crea uno ZIP in
//     memoria (jszip), lo carica in content-media/lora-training/<orgId>/<jobId>.zip,
//     firma un URL, lo passa a fal-ai/flux-lora-fast-training via fal.queue.submit.
//  3. DB: inserisce riga in lora_training_jobs con status=queued + request_id.
//  4. UI: polla getLoraTrainingJobStatusAction ogni 20s. Il training dura
//     tipicamente 5-10 min a 1000 steps.
//  5. Alla completion (status=succeeded su fal): la riga job viene aggiornata
//     e brand_kits.lora_model_url riceve l'URL safetensors (diffusers_lora_file).
//
// Cost: $2 per training run a 1000 steps (default). Addebitato da fal
// quando la submit viene accettata.

import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import { getBrandById } from "@/modules/m02-brand/public";
import { assertAiEnabled, AiKillSwitchError } from "@/modules/m11-admin/public";
import { assertBudgetOk, AiBudgetExceededError, logSpend } from "@/modules/m11-admin/public";
import { getActiveProviderBySlug } from "./media-providers-repo";
import { getMediaAssetById } from "./media-assets-repo";
import { FAL_PROVIDER_SLUG } from "@/lib/ai/fal-config";
import { isFalKeyPresent } from "@/lib/ai/fal";

const LORA_TRAINING_MODEL = "fal-ai/flux-lora-fast-training";
const LORA_TRAINING_COST_USD = 2.0;
const MIN_IMAGES = 4;
const MAX_IMAGES = 30;
const DEFAULT_STEPS = 1000;
const BUCKET = "content-media";

export type StartLoraResult =
  { ok: true; jobId: string; requestId: string } | { ok: false; error: string };

export type LoraJobStatus = "queued" | "in_progress" | "succeeded" | "failed";

export type LoraJob = {
  id: string;
  brandId: string;
  requestId: string;
  status: LoraJobStatus;
  loraUrl: string | null;
  errorMessage: string | null;
  numImages: number;
  triggerWord: string | null;
  createdAt: string;
  succeededAt: string | null;
  failedAt: string | null;
};

export type LoraStatusResult = { ok: true; job: LoraJob } | { ok: false; error: string };

async function preflight(
  organizationId: string,
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
    await assertBudgetOk(organizationId, "fal", LORA_TRAINING_COST_USD);
  } catch (err) {
    if (err instanceof AiBudgetExceededError) return { ok: false, error: err.message };
    throw err;
  }
  const provider = await getActiveProviderBySlug(organizationId, FAL_PROVIDER_SLUG);
  if (!provider) {
    return {
      ok: false,
      error: "Provider fal.ai non attivo (/impostazioni/provider-media).",
    };
  }
  if (!provider.allowedUses.includes("commercial")) {
    return {
      ok: false,
      error: "Provider fal.ai senza 'Commerciale' negli usi consentiti.",
    };
  }
  return { ok: true };
}

/**
 * Avvia un training LoRA per lo stile del brand.
 * - assetIds: 4-30 immagini dalla Libreria media di QUESTO brand.
 * - triggerWord: opzionale; verrà aggiunto come trigger_word al training
 *   per attivare lo stile in inference (es. "lennystyle").
 */
export async function startLoraTrainingAction(input: {
  brandId: string;
  assetIds: string[];
  triggerWord?: string;
}): Promise<StartLoraResult> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "brand.kit.edit");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }

  // Validazione base.
  const unique = Array.from(new Set(input.assetIds));
  if (unique.length < MIN_IMAGES) {
    return {
      ok: false,
      error: `Servono almeno ${MIN_IMAGES} immagini (${unique.length} selezionate).`,
    };
  }
  if (unique.length > MAX_IMAGES) {
    return {
      ok: false,
      error: `Massimo ${MAX_IMAGES} immagini per training (${unique.length} selezionate).`,
    };
  }
  const trigger = (input.triggerWord ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (trigger.length > 30) {
    return { ok: false, error: "Trigger word troppo lunga (max 30 caratteri a-z0-9)." };
  }

  // Ownership brand.
  const brand = await getBrandById(session.organizationId, input.brandId);
  if (!brand) return { ok: false, error: "Marchio non trovato." };

  // Ownership di OGNI asset: deve essere dell'org E dello stesso brand.
  const assets: Array<{ id: string; signedUrl: string; contentType: string }> = [];
  for (const id of unique) {
    const a = await getMediaAssetById(session.organizationId, id);
    if (!a) return { ok: false, error: `Immagine ${id.slice(0, 8)}… non trovata.` };
    if (a.brandId !== brand.id) {
      return { ok: false, error: "Alcune immagini non appartengono a questo marchio." };
    }
    assets.push({ id: a.id, signedUrl: a.signedUrl, contentType: a.contentType });
  }

  const pre = await preflight(session.organizationId);
  if (!pre.ok) return pre;

  // Scarica ogni asset e aggiungilo allo ZIP. jszip costruisce in memoria;
  // 30 immagini × ~1MB = 30MB peak RAM — accettabile.
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    if (!a) continue;
    try {
      const res = await fetch(a.signedUrl, { cache: "no-store" });
      if (!res.ok) {
        return { ok: false, error: `Download immagine fallito: HTTP ${res.status}.` };
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      const ext =
        a.contentType === "image/png" ? "png" : a.contentType === "image/webp" ? "webp" : "jpg";
      zip.file(`${String(i + 1).padStart(2, "0")}.${ext}`, bytes);
    } catch (err) {
      return {
        ok: false,
        error: `Download immagine ${i + 1} fallito: ${err instanceof Error ? err.message : "errore"}.`,
      };
    }
  }
  const zipBytes = await zip.generateAsync({ type: "uint8array" });

  // Upload ZIP nel bucket content-media (temporaneo — resta per retention).
  const admin = getAdminClient();
  const zipPath = `lora-training/${session.organizationId}/${crypto.randomUUID()}.zip`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(zipPath, zipBytes, {
    contentType: "application/zip",
    upsert: false,
  });
  if (upErr) {
    return { ok: false, error: `Upload ZIP training fallito: ${upErr.message}.` };
  }
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(zipPath, 60 * 60 * 24); // 24h: training dura ~10min ma firma larga
  if (signErr || !signed) {
    await admin.storage.from(BUCKET).remove([zipPath]);
    return { ok: false, error: "Firma URL ZIP training fallita." };
  }

  // Submit al queue fal.
  const { fal } = await import("@fal-ai/client");
  type QueueSubmitResult = { request_id?: string; requestId?: string };
  let submitted: QueueSubmitResult;
  try {
    submitted = (await fal.queue.submit(LORA_TRAINING_MODEL, {
      input: {
        images_data_url: signed.signedUrl,
        steps: DEFAULT_STEPS,
        is_style: true,
        ...(trigger ? { trigger_word: trigger } : {}),
      },
    })) as QueueSubmitResult;
  } catch (err) {
    console.error("[fal] lora training submit failed", {
      brandId: brand.id,
      err: err instanceof Error ? err.message : String(err),
    });
    // Submit rifiutata PRIMA dell'addebito: non loggo spesa.
    await admin.storage.from(BUCKET).remove([zipPath]);
    return {
      ok: false,
      error: `Submit training fallito: ${err instanceof Error ? err.message : "errore"}.`,
    };
  }
  const requestId = submitted.request_id ?? submitted.requestId;
  if (!requestId) {
    await admin.storage.from(BUCKET).remove([zipPath]);
    return { ok: false, error: "fal non ha restituito request_id." };
  }

  // Spesa stimata: $2 — fal l'ha accettata, consideriamo addebito.
  try {
    await logSpend({
      organizationId: session.organizationId,
      brandId: brand.id,
      category: "fal",
      action: "lora.training_started",
      costUsd: LORA_TRAINING_COST_USD,
      tokensIn: 0,
      tokensOut: 0,
      targetType: "brand",
      targetId: brand.id,
    });
  } catch (err) {
    console.error("[lora] logSpend start fail", {
      requestId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  // Inserisci riga job.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;
  const { data: row, error: dbErr } = await adminAny
    .from("lora_training_jobs")
    .insert({
      organization_id: session.organizationId,
      brand_id: brand.id,
      request_id: requestId,
      trigger_word: trigger || null,
      is_style: true,
      steps: DEFAULT_STEPS,
      images_zip_url: signed.signedUrl,
      num_images: assets.length,
      status: "queued",
      requested_by: session.userId,
      cost_usd: LORA_TRAINING_COST_USD,
    })
    .select("id")
    .single();
  if (dbErr || !row) {
    console.error("[lora] insert training job failed (fal already charged!)", {
      requestId,
      err: dbErr?.message,
    });
    return {
      ok: false,
      error: `Training avviato su fal (ID ${requestId}) ma non salvato in DB. Spesa già registrata.`,
    };
  }

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "lora.training_started",
    target: `brand:${brand.slug}`,
    details: {
      jobId: row.id,
      requestId,
      numImages: assets.length,
      triggerWord: trigger || null,
      costUsd: LORA_TRAINING_COST_USD,
    },
  });

  return { ok: true, jobId: row.id, requestId };
}

function mapJobRow(row: {
  id: string;
  brand_id: string;
  request_id: string;
  status: string;
  lora_url: string | null;
  error_message: string | null;
  num_images: number;
  trigger_word: string | null;
  created_at: string;
  succeeded_at: string | null;
  failed_at: string | null;
}): LoraJob {
  return {
    id: row.id,
    brandId: row.brand_id,
    requestId: row.request_id,
    status: row.status as LoraJobStatus,
    loraUrl: row.lora_url,
    errorMessage: row.error_message,
    numImages: row.num_images,
    triggerWord: row.trigger_word,
    createdAt: row.created_at,
    succeededAt: row.succeeded_at,
    failedAt: row.failed_at,
  };
}

/**
 * Polling del job LoRA. Se fal risponde "COMPLETED", scarica il risultato,
 * aggiorna la riga e popola brand_kits.lora_model_url. Idempotente.
 */
export async function getLoraTrainingJobStatusAction(input: {
  jobId: string;
}): Promise<LoraStatusResult> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "brand.kit.edit");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: row, error } = await admin
    .from("lora_training_jobs")
    .select(
      "id, organization_id, brand_id, request_id, status, lora_url, error_message, num_images, trigger_word, created_at, succeeded_at, failed_at",
    )
    .eq("id", input.jobId)
    .maybeSingle();
  if (error || !row) return { ok: false, error: "Job training non trovato." };
  if (row.organization_id !== session.organizationId) {
    return { ok: false, error: "Job training non trovato." };
  }

  // Se già terminato, torna lo stato attuale.
  if (row.status === "succeeded" || row.status === "failed") {
    return { ok: true, job: mapJobRow(row) };
  }

  // Poll fal.
  const { fal } = await import("@fal-ai/client");
  type StatusShape = { status?: string; logs?: Array<{ message?: string }> };
  let statusResp: StatusShape;
  try {
    statusResp = (await fal.queue.status(LORA_TRAINING_MODEL, {
      requestId: row.request_id,
    })) as StatusShape;
  } catch (err) {
    console.error("[lora] queue.status failed", {
      requestId: row.request_id,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: true, job: mapJobRow(row) };
  }

  const statusStr = String(statusResp.status ?? "").toUpperCase();
  const now = new Date().toISOString();

  if (statusStr === "IN_QUEUE") {
    if (row.status !== "queued") {
      await admin.from("lora_training_jobs").update({ status: "queued" }).eq("id", row.id);
    }
    return { ok: true, job: { ...mapJobRow(row), status: "queued" } };
  }
  if (statusStr === "IN_PROGRESS") {
    if (row.status !== "in_progress") {
      await admin.from("lora_training_jobs").update({ status: "in_progress" }).eq("id", row.id);
    }
    return { ok: true, job: { ...mapJobRow(row), status: "in_progress" } };
  }

  if (statusStr === "COMPLETED") {
    type ResultShape = {
      data?: {
        diffusers_lora_file?: { url?: string };
        config_file?: { url?: string };
      };
    };
    let result: ResultShape;
    try {
      result = (await fal.queue.result(LORA_TRAINING_MODEL, {
        requestId: row.request_id,
      })) as ResultShape;
    } catch (err) {
      await admin
        .from("lora_training_jobs")
        .update({
          status: "failed",
          failed_at: now,
          error_message: `Risultato training non recuperabile: ${err instanceof Error ? err.message : "errore"}`,
        })
        .eq("id", row.id);
      return { ok: true, job: { ...mapJobRow(row), status: "failed" } };
    }
    const loraUrl = result.data?.diffusers_lora_file?.url ?? null;
    const configUrl = result.data?.config_file?.url ?? null;
    if (!loraUrl) {
      await admin
        .from("lora_training_jobs")
        .update({
          status: "failed",
          failed_at: now,
          error_message: "Training completato ma manca diffusers_lora_file.url.",
        })
        .eq("id", row.id);
      return { ok: true, job: { ...mapJobRow(row), status: "failed" } };
    }

    // Aggiorna riga job + brand_kits.lora_model_url (idempotente).
    await admin
      .from("lora_training_jobs")
      .update({
        status: "succeeded",
        lora_url: loraUrl,
        config_url: configUrl,
        succeeded_at: now,
      })
      .eq("id", row.id);
    await admin
      .from("brand_kits")
      .update({ lora_model_url: loraUrl, updated_at: now })
      .eq("brand_id", row.brand_id);

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: null,
      actorKind: "system",
      action: "lora.training_succeeded",
      target: `brand:${row.brand_id}`,
      details: { jobId: row.id, requestId: row.request_id, loraUrl },
    });
    return {
      ok: true,
      job: {
        ...mapJobRow(row),
        status: "succeeded",
        loraUrl,
        succeededAt: now,
      },
    };
  }

  // Altri stati (FAILED, ERROR, ...) → fallimento.
  const errMsg = statusResp.logs?.slice(-1)[0]?.message ?? `Training fallito (status ${statusStr})`;
  await admin
    .from("lora_training_jobs")
    .update({ status: "failed", failed_at: now, error_message: errMsg })
    .eq("id", row.id);
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: null,
    actorKind: "system",
    action: "lora.training_failed",
    target: `brand:${row.brand_id}`,
    details: { jobId: row.id, requestId: row.request_id, status: statusStr, errMsg },
  });
  return { ok: true, job: { ...mapJobRow(row), status: "failed", errorMessage: errMsg } };
}

/**
 * Lista degli ultimi training LoRA del brand per la UI (storico).
 */
export async function listLoraTrainingJobsAction(input: {
  brandId: string;
}): Promise<{ ok: true; items: LoraJob[] } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "brand.kit.edit");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }
  const brand = await getBrandById(session.organizationId, input.brandId);
  if (!brand) return { ok: false, error: "Marchio non trovato." };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: rows, error } = await admin
    .from("lora_training_jobs")
    .select(
      "id, brand_id, request_id, status, lora_url, error_message, num_images, trigger_word, created_at, succeeded_at, failed_at",
    )
    .eq("organization_id", session.organizationId)
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) return { ok: false, error: error.message };
  return { ok: true, items: (rows ?? []).map(mapJobRow) };
}

/**
 * Rimuove il LoRA attualmente impostato sul brand (es. se non piace).
 * NON cancella i file su fal CDN (rimangono accessibili tramite URL).
 */
export async function clearBrandLoraAction(input: {
  brandId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "brand.kit.edit");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }
  const brand = await getBrandById(session.organizationId, input.brandId);
  if (!brand) return { ok: false, error: "Marchio non trovato." };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("brand_kits")
    .update({ lora_model_url: null, updated_at: new Date().toISOString() })
    .eq("brand_id", brand.id);
  if (error) return { ok: false, error: error.message };
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "lora.cleared",
    target: `brand:${brand.slug}`,
    details: {},
  });
  return { ok: true };
}
