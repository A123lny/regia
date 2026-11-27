"use server";

// Test di connessione per i servizi esterni. Ogni test fa una chiamata reale
// MINIMA (zero costo quando possibile) e ritorna { ok, message } leggibile IT.
//
// Nessuna chiave è esposta al client: le chiamate vivono tutte server-side.

import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
import { requireCapability } from "@/lib/auth/permissions";

export type DiagResult = { ok: boolean; message: string };

async function requireOwner() {
  const session = await getSessionOrRedirect();
  requireCapability(session, "team.manage");
  return session;
}

// ─────────────────────────────────────────────────────────────── Gemini
// Test identico al percorso reale: usa lo STESSO wrapper (@/lib/ai/gemini)
// e lo STESSO SDK (@google/genai) che il robottino e i generatori usano in
// produzione. Chiamata minima (~10 token out, free tier). Se la chiave
// funziona qui, funziona anche lì; se fallisce, l'errore è lo stesso che
// vedresti nel flusso reale.
export async function testGeminiAction(): Promise<DiagResult> {
  await requireOwner();
  const key = process.env["GEMINI_API_KEY"];
  if (!key || !key.trim()) {
    return { ok: false, message: "Chiave Gemini non impostata (GEMINI_API_KEY)." };
  }
  try {
    const { generateText } = await import("@/lib/ai/gemini");
    const r = await generateText({
      systemPrompt: "Reply with exactly: OK",
      userMessage: "ping",
      maxTokens: 10,
      responseMimeType: "text/plain",
    });
    if (!r.text || r.text.trim().length === 0) {
      return { ok: false, message: "Gemini ha risposto vuoto." };
    }
    return {
      ok: true,
      message: `Connessione OK — risposta ricevuta (${r.model}, ${r.tokensOut} tok, ${r.latencyMs}ms).`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Il wrapper lancia AiConfigError, AiRateLimitError, ecc. — i messaggi
    // sono già in italiano (vedi gemini.ts). Li propaghiamo tali e quali.
    return { ok: false, message: msg };
  }
}

// ─────────────────────────────────────────────────────────────── fal.ai
// Test AUTENTICATO a costo zero: GET status di un request_id dummy sulla
// coda flux/schnell. Risposte attese:
//   401/403   → chiave non valida o revocata
//   402       → crediti esauriti
//   404       → chiave VALIDA (request non esiste, ma l'auth è OK) ✓
//   429       → rate limit temporaneo
//   5xx/time  → fal down
export async function testFalAction(): Promise<DiagResult> {
  await requireOwner();
  const key = process.env["FAL_KEY"];
  if (!key || !key.trim()) {
    return { ok: false, message: "Chiave fal.ai non impostata (FAL_KEY)." };
  }
  const dummyId = "00000000-0000-0000-0000-000000000000";
  try {
    const res = await fetch(
      `https://queue.fal.run/fal-ai/flux/schnell/requests/${dummyId}/status`,
      {
        method: "GET",
        headers: { Authorization: `Key ${key}` },
        signal: AbortSignal.timeout(10_000),
      },
    );
    const text = await res.text().catch(() => "");
    const bodyLower = text.toLowerCase();
    if (res.status === 401) {
      return { ok: false, message: "Chiave fal.ai non valida o scaduta (401)." };
    }
    if (res.status === 403) {
      if (bodyLower.includes("balance") || bodyLower.includes("credit")) {
        return { ok: false, message: "fal.ai: credito esaurito (403 balance)." };
      }
      if (bodyLower.includes("locked") || bodyLower.includes("suspended")) {
        return { ok: false, message: "Account fal.ai bloccato o sospeso (403)." };
      }
      return { ok: false, message: "Accesso fal.ai negato (403). Verifica la chiave." };
    }
    if (res.status === 402) {
      return { ok: false, message: "fal.ai: pagamento richiesto / credito esaurito (402)." };
    }
    if (res.status === 429) {
      return { ok: false, message: "fal.ai: troppe richieste (429). Riprova fra poco." };
    }
    if (res.status === 404) {
      return {
        ok: true,
        message:
          "Connessione OK — chiave fal.ai autenticata (404 su dummy ID è il risultato atteso).",
      };
    }
    if (res.status >= 500) {
      return { ok: false, message: `fal.ai ha risposto con errore server ${res.status}.` };
    }
    return { ok: true, message: `Connessione OK — fal.ai raggiungibile (status ${res.status}).` };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, message: "fal.ai: timeout di 10 secondi superato." };
    }
    return {
      ok: false,
      message: `Errore di rete verso fal.ai: ${err instanceof Error ? err.message : "sconosciuto"}.`,
    };
  }
}

// ─────────────────────────────────────────────────────────────── Creatomate
export async function testCreatomateAction(): Promise<DiagResult> {
  await requireOwner();
  const key = process.env["CREATOMATE_API_KEY"];
  if (!key || !key.trim()) {
    return { ok: false, message: "Chiave Creatomate non impostata (CREATOMATE_API_KEY)." };
  }
  try {
    // GET /v2/templates è il più leggero: lista template del progetto.
    // Zero credito consumato.
    const res = await fetch("https://api.creatomate.com/v2/templates?limit=1", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "Chiave Creatomate non valida (401/403)." };
    }
    if (res.status === 402) {
      return { ok: false, message: "Piano Creatomate scaduto o crediti esauriti (402)." };
    }
    if (!res.ok) {
      return { ok: false, message: `Creatomate ha risposto con errore ${res.status}.` };
    }
    return { ok: true, message: "Connessione OK — API Creatomate raggiungibile." };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, message: "Creatomate: timeout di 10 secondi superato." };
    }
    return {
      ok: false,
      message: `Errore di rete verso Creatomate: ${err instanceof Error ? err.message : "sconosciuto"}.`,
    };
  }
}

// ─────────────────────────────────────────────────────────── Supabase Storage
// Test identico al percorso reale: upload di un PNG 1×1 trasparente con
// content-type image/png, come il flusso Libreria media / Generazione AI.
// Il bucket ha ALLOWED_MIME_TYPES che includono image/*; text/plain veniva
// rifiutato da policy strict (false negative).
const PNG_1x1_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
]);

export async function testStorageAction(): Promise<DiagResult> {
  await requireOwner();
  try {
    const admin = getAdminClient();
    const { data: buckets, error: listErr } = await admin.storage.listBuckets();
    if (listErr) {
      return {
        ok: false,
        message: `Supabase Storage: ${listErr.message}. Verifica SUPABASE_SERVICE_ROLE_KEY.`,
      };
    }
    const contentMedia = (buckets ?? []).find((b) => b.name === "content-media");
    if (!contentMedia) {
      return {
        ok: false,
        message: "Bucket 'content-media' non trovato. Crealo dal dashboard Supabase Storage.",
      };
    }
    // Upload PNG 1×1 reale, come la Libreria media.
    const path = `media/_diag/${Date.now()}.png`;
    const { error: upErr } = await admin.storage.from("content-media").upload(path, PNG_1x1_BYTES, {
      contentType: "image/png",
      upsert: false,
    });
    if (upErr) {
      return {
        ok: false,
        message: `Upload PNG fallito: ${upErr.message}. Verifica policy RLS su storage.objects e ALLOWED_MIME_TYPES del bucket.`,
      };
    }
    // Firma URL (percorso Libreria lo fa sempre).
    const { error: signErr } = await admin.storage.from("content-media").createSignedUrl(path, 60);
    await admin.storage.from("content-media").remove([path]);
    if (signErr) {
      return {
        ok: false,
        message: `Upload OK ma firma URL fallita: ${signErr.message}.`,
      };
    }
    return {
      ok: true,
      message: "Bucket content-media OK (upload PNG 1×1 + firma URL + delete riusciti).",
    };
  } catch (err) {
    return {
      ok: false,
      message: `Errore Supabase Storage: ${err instanceof Error ? err.message : "sconosciuto"}.`,
    };
  }
}

// ─────────────────────────────────────────────────────────── Satori / resvg
// Usa il PRIMO template realmente registrato (tipicamente lenny-*): così
// basta che la pipeline "Da template" funzioni per questo per avere garanzia
// che funzioni per gli altri. Niente ID hardcoded fantasma (promo-announce
// non esiste nella registry).
export async function testTemplateRenderAction(): Promise<DiagResult> {
  await requireOwner();
  try {
    const { renderTemplateToPng } = await import("@/modules/m04-media/server");
    const { TEMPLATE_DEFINITIONS } = await import("@/modules/m04-media/public");
    const def = TEMPLATE_DEFINITIONS[0];
    if (!def) {
      return { ok: false, message: "Nessun template registrato nella registry." };
    }
    const fields: Record<string, string> = {};
    for (const f of def.fields) fields[f.key] = f.required ? "Test" : "";
    const { pngBytes, width, height } = await renderTemplateToPng(def.id, {
      brandDisplayName: "Test Brand",
      brandColor: "#a84a2d",
      brandLogoUrl: null,
      fields,
    });
    return {
      ok: true,
      message: `Rendering OK (${def.id}) — PNG ${width}×${height}, ${pngBytes.byteLength} byte.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Rendering template fallito: ${err instanceof Error ? err.message : "sconosciuto"}. Cause tipiche: font-loader non raggiunge cdn.jsdelivr.net/unpkg.com, resvg-js nativo non disponibile, oppure harfbuzzjs/hb.wasm non incluso nel bundle (vedi outputFileTracingIncludes in next.config).`,
    };
  }
}
