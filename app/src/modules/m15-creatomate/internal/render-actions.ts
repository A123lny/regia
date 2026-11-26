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
  isCreatomateKeyPresent,
  type CreatomateRenderQuality,
} from "@/lib/creatomate/config";
import { getActiveProviderBySlug } from "@/modules/m04-media/internal/media-providers-repo";
import { insertCreatomateRender, getRenderById } from "./creatomate-renders-repo";
import { applySucceededRenderByExternalId } from "./apply-succeeded";
import { listBrandTemplates } from "./brand-templates-repo";
import { sourceForVariant, type DefaultVariant } from "./default-sources";

export type StartRenderResult =
  { ok: true; renderId: string; externalId: string; status: string } | { ok: false; error: string };

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
// Policy:
//  - normalizza chiave: trim + case-sensitive (Creatomate matcha case-exact
//    sui placeholder); rigetta se vuota / troppo lunga / contiene prefissi
//    riservati
//  - rigetta le chiavi che corrispondono a dimensioni/durata/formato: queste
//    vanno in top-level body, non dentro modifications
//  - accetta solo proprietà finali safe: senza suffisso, o che terminano in
//    .text, .fill_color, .source, .src, .color — pattern tipici di
//    placeholder di template Creatomate. Altri path (.width, .duration,
//    .frame_rate, .background_color root) sono bloccati
// ────────────────────────────────────────────────────────────────────────
const BLOCKED_MOD_FINAL_KEYS = new Set<string>([
  "width",
  "height",
  "frame_rate",
  "duration",
  "output_format",
  "trim_start",
  "trim_duration",
]);
const ALLOWED_MOD_SUFFIXES = new Set<string>(["text", "fill_color", "source", "src", "color"]);
const MAX_MOD_KEYS = 40;
const MAX_MOD_VALUE_LEN = 2000;

// Host allowlist per i campi `source`/`src` (media URL passati a Creatomate).
// Due famiglie:
//  - storage Supabase di questo progetto (dove salviamo gli asset brand)
//  - domini fal.ai e Creatomate (asset generati nella stessa pipeline)
// Senza allowlist un utente malintenzionato può usare source=http://internal
// come SSRF attraverso Creatomate (Creatomate fetcha per noi).
/**
 * Valida un URL come safe per source/src media. Ritorna la stringa normalizzata
 * (u.href senza userinfo/porte non default) se è nell'allowlist, altrimenti null.
 * Reject: non-https, backslash, userinfo (user:pass@), porte custom, control chars.
 */
function sanitizeSourceUrl(raw: string): string | null {
  // Rifiuta control characters e backslash (parser differential JS vs upstream).
  // Allow tab/CR/LF solo per confirmed text fields; qui su URL li blocchiamo tutti.
  if (/[\x00-\x1f\x7f\\]/.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.username || u.password) return null; // no userinfo
  if (u.port && u.port !== "443") return null; // no custom port
  const h = u.hostname;
  const supaUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "";
  let supaHost = "";
  try {
    supaHost = supaUrl ? new URL(supaUrl).hostname : "";
  } catch {
    supaHost = "";
  }
  const allowed = [
    "cdn.creatomate.com",
    "creatomate-static.s3.amazonaws.com",
    "creatomate-static.s3.eu-west-1.amazonaws.com",
    "fal.media",
    "v3.fal.media",
    "v2.fal.media",
  ];
  const ok =
    (supaHost && h === supaHost) || allowed.some((d) => h === d || h.endsWith("." + d));
  if (!ok) return null;
  return u.href;
}

function sanitizeModifications(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  let n = 0;
  for (const [rawKey, v] of Object.entries(raw)) {
    if (n >= MAX_MOD_KEYS) break;
    if (typeof rawKey !== "string") continue;
    const k = rawKey.trim();
    if (k.length === 0 || k.length > 120) continue;
    if (k.startsWith("__") || k.startsWith(".")) continue;
    const parts = k.split(".");
    const last = (parts[parts.length - 1] ?? "").toLowerCase();
    if (BLOCKED_MOD_FINAL_KEYS.has(last)) continue;
    if (parts.length > 1 && !ALLOWED_MOD_SUFFIXES.has(last)) continue;
    if (v === null || v === undefined) continue;
    const rawVal =
      typeof v === "string" ? v : typeof v === "number" || typeof v === "boolean" ? String(v) : "";
    if (!rawVal) continue;
    // Rifiuta C0 control char (0x00-0x1f) e 0x7f su QUALSIASI valore: non
    // ammessi in mod Creatomate. (Se in futuro servono \n per campi text,
    // whitelist esplicito per quelle chiavi.)
    if (/[\x00-\x1f\x7f]/.test(rawVal)) continue;
    // Truncate PRIMA della validazione per evitare "https://safe.cdn.../..." + garbage.
    const val = rawVal.slice(0, MAX_MOD_VALUE_LEN);
    // Canonical form per detection URL-like: nessun trim ulteriore (i control
    // char che potevano "mascherare" lo schema li abbiamo già bloccati sopra).
    const looksUrlish = /^\s*([a-z][a-z0-9+.-]*:|[/\\]{2})/i.test(val);
    if (last === "source" || last === "src" || looksUrlish) {
      // Usa il VALORE NORMALIZZATO ritornato da sanitizeSourceUrl, non quello
      // originale. Altrimenti si introduce un parser-differential tra il
      // nostro validator e Creatomate (es. URL con tab embedded che JS URL()
      // accetta ma il server HTTP downstream interpreta diversamente).
      const safe = sanitizeSourceUrl(val);
      if (safe === null) continue;
      if (safe.length > MAX_MOD_VALUE_LEN) continue;
      out[k] = safe;
      n++;
      continue;
    }
    out[k] = val;
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
  if (!isCreatomateKeyPresent()) {
    return {
      ok: false,
      error:
        "Chiave Creatomate non impostata. Chiedi all'amministratore di configurare CREATOMATE_API_KEY (Impostazioni → /impostazioni).",
    };
  }
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
        'Provider Creatomate non attivo in Impostazioni → Provider media (/impostazioni/provider-media). Registralo con slug "creatomate" e diritti d\'uso "commercial" per generare visual.',
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

  // Template allowlist: il templateId deve essere fra quelli registrati per
  // il brand (sezione "Template Creatomate" nel marchio). Blocca che un
  // utente autenticato lanci render su qualunque template globale del
  // progetto Creatomate, incluso di un altro tenant se gli slippa l'ID.
  const allowedTemplates = await listBrandTemplates(session.organizationId, brand.id, true);
  if (!allowedTemplates.some((t) => t.templateId === input.templateId)) {
    return {
      ok: false,
      error:
        "Template non registrato per questo marchio. Aggiungilo in Marchio → Template Creatomate.",
    };
  }

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
    // Sibling-path parity con fal: errori post-accettazione (timeout, 5xx)
    // possono comunque aver addebitato crediti. CreatomateConfigError e
    // CreatomateRateLimitError sono pre-accettazione (0 cost).
    const status = err instanceof CreatomateError ? err.status : 0;
    const isConfigError = err instanceof CreatomateConfigError;
    const isRateLimit = err instanceof CreatomateRateLimitError;
    const possiblyCharged =
      !isConfigError && !isRateLimit && (status === 0 || status >= 500 || status === 504);
    if (possiblyCharged) {
      try {
        await logSpend({
          organizationId: session.organizationId,
          brandId: brand.id,
          category: "creatomate",
          action: "creatomate.render_errored_possibly_charged",
          costUsd: estimatedUsd,
          tokensIn: 0,
          tokensOut: 0,
          targetType: "draft",
          ...(input.draftId ? { targetId: input.draftId } : {}),
        });
      } catch (logErr) {
        console.error("[creatomate] logSpend on error fail", {
          err: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }
    }
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

/**
 * Avvia render Creatomate usando un DEFAULT inline (RenderScript JSON),
 * senza richiedere un template preregistrato nel pannello Creatomate o
 * nella mappatura brand. Permette "Crea visual" di funzionare subito
 * dopo l'attivazione dell'account.
 *
 * Varianti disponibili (vedi default-sources.ts):
 *  - square_post: 1080×1080 jpg (post Instagram/FB)
 *  - story_reel:  1080×1920 mp4 8s (story/reel verticale)
 *  - poster_a4:   2480×3508 jpg (locandina stampa)
 *
 * Il brand kit (color, logo) e la bozza forniscono i contenuti dinamici.
 */
export async function startCreatomateDefaultRender(input: {
  brandId: string;
  draftId?: string;
  variant: DefaultVariant;
  shortTitle: string;
  body: string;
  ctaText?: string;
}): Promise<StartRenderResult> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "content.generate");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }
  if (!input.brandId) return { ok: false, error: "brandId mancante." };
  if (input.variant !== "square_post" && input.variant !== "story_reel" && input.variant !== "poster_a4") {
    return { ok: false, error: "Variante non valida." };
  }

  const brand = await getBrandById(session.organizationId, input.brandId);
  if (!brand) return { ok: false, error: "Marchio non trovato." };

  if (input.draftId) {
    const draft = await getContentDraft(input.draftId, session.organizationId);
    if (!draft) return { ok: false, error: "Bozza non trovata." };
    if (draft.brandId !== brand.id) {
      return { ok: false, error: "La bozza non appartiene a questo marchio." };
    }
  }

  // Preset test: dimensioni ridotte in test, full in final. Per i default
  // inline usiamo sempre dimensioni "final" perché le risoluzioni sono
  // fisse per convenzione variant; stimiamo 3 crediti per mp4, 1 per jpg.
  const estimatedCredits = input.variant === "story_reel" ? 3 : 1;
  const estimatedUsd = estimatedCredits * CREATOMATE_USD_PER_CREDIT;

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

  const source = sourceForVariant(
    input.variant,
    {
      displayName: brand.displayName,
      color: brand.color,
      logoUrl: brand.logoUrl ?? null,
    },
    {
      shortTitle: (input.shortTitle || "").slice(0, 120),
      body: (input.body || "").slice(0, 400),
      ...(input.ctaText ? { ctaText: input.ctaText.slice(0, 40) } : {}),
    },
  );

  let r;
  try {
    r = await createRender({
      source,
      webhookUrl,
      metadata: {
        brandId: brand.id,
        brandSlug: brand.slug,
        variant: input.variant,
        ...(input.draftId ? { draftId: input.draftId } : {}),
        requestedBy: session.userId,
      },
    });
  } catch (err) {
    console.error("[creatomate] default render failed", {
      brandSlug: brand.slug,
      variant: input.variant,
      err: err instanceof Error ? err.message : String(err),
    });
    const status = err instanceof CreatomateError ? err.status : 0;
    const isConfigError = err instanceof CreatomateConfigError;
    const isRateLimit = err instanceof CreatomateRateLimitError;
    const possiblyCharged =
      !isConfigError && !isRateLimit && (status === 0 || status >= 500 || status === 504);
    if (possiblyCharged) {
      try {
        await logSpend({
          organizationId: session.organizationId,
          brandId: brand.id,
          category: "creatomate",
          action: "creatomate.default_render_errored_possibly_charged",
          costUsd: estimatedUsd,
          tokensIn: 0,
          tokensOut: 0,
          targetType: "draft",
          ...(input.draftId ? { targetId: input.draftId } : {}),
        });
      } catch {
        // best-effort
      }
    }
    return { ok: false, error: mapCreatomateError(err) };
  }

  try {
    await logSpend({
      organizationId: session.organizationId,
      brandId: brand.id,
      category: "creatomate",
      action: "creatomate.default_render_started",
      costUsd: estimatedUsd,
      tokensIn: 0,
      tokensOut: 0,
      targetType: "draft",
      ...(input.draftId ? { targetId: input.draftId } : {}),
    });
  } catch {
    // best-effort
  }
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "creatomate.default_render_started",
    target: `render:${r.id}`,
    details: {
      provider: "creatomate",
      variant: input.variant,
      externalId: r.id,
      estimatedCredits,
      estimatedCostUsd: estimatedUsd,
    },
  });

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
      templateId: `__default_${input.variant}`,
      modifications: { variant: input.variant, shortTitle: input.shortTitle, body: input.body },
      webhookToken,
      requestedBy: session.userId,
      initialStatus,
    });
    return { ok: true, renderId: row.id, externalId: r.id, status: row.status };
  } catch (err) {
    console.error("[creatomate] default insertRender fail", {
      externalId: r.id,
      err: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      error: `Render avviato su Creatomate ma non salvato in locale. ID: ${r.id}`,
    };
  }
}
