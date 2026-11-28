// Funzione interna (NON server action) per applicare il completamento di un
// render: scarica l'output dall'URL FIDATO (preso via getRender dall'API
// Creatomate, non dal payload del webhook), lo salva nel bucket come
// brand_media_asset, aggiorna la riga render a succeeded. Idempotente via
// claim atomico sulla row (claim riuscito solo se status in {queued,
// planned, rendering}).
//
// NON è una server action ("use server" assente). NON è esposta dal public
// barrel. Chiamata solo da:
//   - webhook-handler (dopo claim atomico, URL re-fetchato da Creatomate)
//   - polling GET /renders/[id] (dopo claim atomico, URL dall'API)

import "server-only";
import { randomUUID } from "node:crypto";
import { URL as NodeURL } from "node:url";
import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { logAuditEvent } from "@/lib/audit/log";
import { getContentDraft } from "@/modules/m03-editorial/public";
import { insertMediaAsset, setDraftMediaAsset, type MediaAsset } from "@/modules/m04-media/public";
import { getBrandById } from "@/modules/m02-brand/public";
import { getRender } from "@/lib/creatomate/client";
import { getRenderByExternalId, updateRenderStatus } from "./creatomate-renders-repo";

const BUCKET = "content-media";
// Byte cap per download output: 50 MB è sufficiente per render video ~10s @ 720p
// ed evita download runaway. Server-side forziamo il cap via Content-Length
// e taglio stream.
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
// Timeout esplicito sul fetch (non ci fidiamo solo del default).
const DOWNLOAD_TIMEOUT_MS = 60_000;

// Host consentiti per l'URL di output Creatomate.
// Creatomate serve i file su Backblaze B2 (fXXX.backblazeb2.com dove XXX
// identifica il pod geografico) + fallback S3 / CDN custom. Allowlist con
// match esatto per i domini noti e suffix match per backblaze (pod rotanti).
const ALLOWED_OUTPUT_HOSTS_EXACT = new Set<string>([
  "cdn.creatomate.com",
  "creatomate-static.s3.amazonaws.com",
  "creatomate-static.s3.eu-west-1.amazonaws.com",
  "creatomate.s3.eu-west-1.amazonaws.com",
]);
// Suffissi di secondo-livello consentiti (host.endsWith("." + suffix)).
const ALLOWED_OUTPUT_HOSTS_SUFFIX = ["backblazeb2.com"];

function isAllowedOutputHost(hostname: string): boolean {
  if (ALLOWED_OUTPUT_HOSTS_EXACT.has(hostname)) return true;
  for (const suffix of ALLOWED_OUTPUT_HOSTS_SUFFIX) {
    if (hostname === suffix || hostname.endsWith("." + suffix)) return true;
  }
  return false;
}

const ALLOWED_OUTPUT_CT = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
]);

export class RenderOutputSsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RenderOutputSsrfError";
  }
}

function assertSafeOutputUrl(raw: string): URL {
  let u: URL;
  try {
    u = new NodeURL(raw);
  } catch {
    throw new RenderOutputSsrfError("URL output non valido.");
  }
  if (u.protocol !== "https:") {
    throw new RenderOutputSsrfError("L'URL di output deve essere HTTPS.");
  }
  if (!isAllowedOutputHost(u.hostname)) {
    throw new RenderOutputSsrfError(`Host non autorizzato per output: ${u.hostname}`);
  }
  return u;
}

function extForContentType(ct: string): { ext: string; type: string } {
  const c = ct.toLowerCase().split(";")[0]?.trim() ?? "";
  if (c === "video/mp4") return { ext: "mp4", type: "video/mp4" };
  if (c === "video/webm") return { ext: "webm", type: "video/webm" };
  if (c === "image/png") return { ext: "png", type: "image/png" };
  if (c === "image/webp") return { ext: "webp", type: "image/webp" };
  if (c === "image/gif") return { ext: "gif", type: "image/gif" };
  return { ext: "jpg", type: "image/jpeg" };
}

async function downloadAndSave(input: {
  outputUrl: string;
  organizationId: string;
  brandId: string;
  caption: string;
  tags: string[];
  uploadedBy: string;
}): Promise<MediaAsset> {
  assertSafeOutputUrl(input.outputUrl);

  const res = await fetch(input.outputUrl, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Download output Creatomate fallito (status ${res.status}).`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!ALLOWED_OUTPUT_CT.has(ct.split(";")[0]?.trim() ?? "")) {
    throw new Error(`Content-type non consentito per output: ${ct}`);
  }
  const cl = Number(res.headers.get("content-length") ?? "0");
  if (cl > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Output troppo grande (${cl} byte).`);
  }
  // Stream read con tetto hard sul totale byte
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Stream output non disponibile.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_DOWNLOAD_BYTES) {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
      throw new Error(`Output troppo grande (> ${MAX_DOWNLOAD_BYTES} byte).`);
    }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const { ext, type } = extForContentType(ct);

  const assetId = randomUUID();
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const storagePath = `media/${input.organizationId}/${input.brandId}/${yyyy}/${mm}/${assetId}.${ext}`;

  const admin = getAdminClient();
  const { error: upErr } = await admin.storage.from(BUCKET).upload(storagePath, buf, {
    contentType: type,
    upsert: false,
  });
  if (upErr) {
    console.error("[creatomate] bucket upload failed", {
      bucket: BUCKET,
      path: storagePath,
      msg: upErr.message,
    });
    throw new Error("Impossibile salvare il video/immagine nella Libreria media.");
  }
  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
  if (signErr || !signed) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    throw new Error("Output salvato ma URL firmato non disponibile.");
  }

  return insertMediaAsset({
    organizationId: input.organizationId,
    brandId: input.brandId,
    storagePath,
    signedUrl: signed.signedUrl,
    contentType: type as "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm",
    sizeBytes: buf.byteLength,
    width: null,
    height: null,
    tags: input.tags,
    caption: input.caption.slice(0, 500),
    uploadedBy: input.uploadedBy,
  });
}

/**
 * Prova a claim atomicamente la riga render per chiuderla come succeeded.
 * Ritorna true se il claim è andato (eravamo noi i primi), false altrimenti
 * (duplicato — qualcuno ha già elaborato questo render). Idempotenza.
 */
async function tryClaim(externalId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("creatomate_renders")
    .update({ status: "rendering" })
    .eq("external_id", externalId)
    .in("status", ["queued", "planned", "rendering"])
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("[creatomate] claim error", { externalId, msg: error.message });
    return false;
  }
  return !!data;
}

/**
 * Applica il completamento. Deriva tutto dalla row DB (organizationId, brandId,
 * draftId, requestedBy), ricarica l'URL output chiamando Creatomate con la
 * nostra chiave (non si fida del payload webhook: anti-SSRF).
 *
 * Idempotente: se la row è già succeeded/failed/cancelled, non fa nulla.
 */
export async function applySucceededRenderByExternalId(externalId: string): Promise<
  | {
      ok: true;
      assetId: string | null;
      alreadyDone?: boolean;
    }
  | { ok: false; error: string }
> {
  const row = await getRenderByExternalId(externalId);
  if (!row) return { ok: false, error: "Render non trovato in DB." };
  if (row.status === "succeeded" || row.status === "failed" || row.status === "cancelled") {
    return { ok: true, assetId: row.assetId, alreadyDone: true };
  }

  // Claim atomico: evita doppia esecuzione (webhook + polling concorrenti).
  const claimed = await tryClaim(externalId);
  if (!claimed) {
    const after = await getRenderByExternalId(externalId);
    return { ok: true, assetId: after?.assetId ?? null, alreadyDone: true };
  }

  // Re-fetch dall'API Creatomate: l'unico URL fidato per il download è quello
  // restituito dalla GET autenticata. Il webhook payload può essere
  // manipolato (anche se il token è nostro, non ci fidiamo dell'URL dentro).
  let live;
  try {
    live = await getRender(externalId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore nel refetch Creatomate.";
    await updateRenderStatus({ externalId, status: "failed", errorMessage: msg });
    return { ok: false, error: msg };
  }

  if (live.status !== "succeeded" || !live.url) {
    // Lo status reale non è succeeded — non siamo a quel punto, riportiamo
    // su DB lo stato attuale.
    const mapped =
      live.status === "failed" || live.status === "cancelled"
        ? "failed"
        : live.status === "rendering" || live.status === "transcribing"
          ? "rendering"
          : "planned";
    await updateRenderStatus({
      externalId,
      status: mapped as "rendering" | "planned" | "failed",
      ...(mapped === "failed" ? { errorMessage: live.error_message ?? "Render fallito." } : {}),
    });
    return {
      ok: false,
      error: `Render non in succeeded su Creatomate (stato: ${live.status}).`,
    };
  }

  // Verifica ulteriore ownership: brand/draft devono essere della stessa org.
  const brand = await getBrandById(row.organizationId, row.brandId);
  if (!brand) {
    await updateRenderStatus({
      externalId,
      status: "failed",
      errorMessage: "Brand non più accessibile.",
    });
    return { ok: false, error: "Brand non trovato." };
  }
  let draftIsAttachable = false;
  if (row.draftId) {
    const draft = await getContentDraft(row.draftId, row.organizationId);
    draftIsAttachable =
      !!draft &&
      draft.brandId === row.brandId &&
      draft.status !== "published" &&
      draft.status !== "rejected";
  }

  let asset: MediaAsset;
  try {
    asset = await downloadAndSave({
      outputUrl: live.url,
      organizationId: row.organizationId,
      brandId: row.brandId,
      caption: `[Creatomate] render ${externalId.slice(0, 8)}`,
      tags: ["creatomate", "ai-generated", live.output_format ?? "video"],
      uploadedBy: row.requestedBy,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore scaricando l'output Creatomate.";
    await updateRenderStatus({
      externalId,
      status: "failed",
      errorMessage: msg,
    });
    return { ok: false, error: msg };
  }

  if (row.draftId && draftIsAttachable) {
    try {
      await setDraftMediaAsset(row.organizationId, row.draftId, asset.id);
    } catch (err) {
      console.error("[creatomate] setDraftMediaAsset failed", {
        externalId,
        draftId: row.draftId,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await updateRenderStatus({
    externalId,
    status: "succeeded",
    outputUrl: live.url,
    snapshotUrl: live.snapshot_url ?? null,
    outputFormat: live.output_format ?? null,
    width: live.width ?? null,
    height: live.height ?? null,
    durationSeconds: live.duration ?? null,
    assetId: asset.id,
  });

  await logAuditEvent({
    organizationId: row.organizationId,
    actorUserId: row.requestedBy,
    actorKind: "system",
    action: "creatomate.render_succeeded",
    target: `render:${row.id}`,
    details: {
      provider: "creatomate",
      externalId,
      assetId: asset.id,
      outputFormat: live.output_format ?? null,
      width: live.width ?? null,
      height: live.height ?? null,
      durationSeconds: live.duration ?? null,
    },
  });

  if (row.draftId) revalidatePath(`/contenuti`);
  return { ok: true, assetId: asset.id };
}
