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
export async function testGeminiAction(): Promise<DiagResult> {
  await requireOwner();
  const key = process.env["GEMINI_API_KEY"];
  if (!key || !key.trim()) {
    return { ok: false, message: "Chiave Gemini non impostata (GEMINI_API_KEY)." };
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "Chiave Gemini non valida (401/403)." };
    }
    if (res.status === 429) {
      return { ok: false, message: "Gemini: limite di richieste. Riprova fra poco." };
    }
    if (!res.ok) {
      return { ok: false, message: `Gemini ha risposto con errore ${res.status}.` };
    }
    return { ok: true, message: "Connessione OK — modelli raggiungibili." };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, message: "Gemini: timeout di 10 secondi superato." };
    }
    return {
      ok: false,
      message: `Errore di rete verso Gemini: ${err instanceof Error ? err.message : "sconosciuto"}.`,
    };
  }
}

// ─────────────────────────────────────────────────────────────── fal.ai
export async function testFalAction(): Promise<DiagResult> {
  await requireOwner();
  const key = process.env["FAL_KEY"];
  if (!key || !key.trim()) {
    return { ok: false, message: "Chiave fal.ai non impostata (FAL_KEY)." };
  }
  // Endpoint auth check molto leggero: /models richiede solo auth, nessun billing.
  try {
    const res = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
      method: "OPTIONS",
      headers: { Authorization: `Key ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "Chiave fal.ai non valida (401/403)." };
    }
    // OPTIONS risponde 200/204 su endpoint esistenti: qualunque risposta che
    // non sia 4xx-auth ci dice che il server riconosce la chiave.
    if (res.status >= 500) {
      return {
        ok: false,
        message: `fal.ai ha risposto con errore server ${res.status}.`,
      };
    }
    return { ok: true, message: "Connessione OK — fal.ai raggiungibile." };
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
export async function testStorageAction(): Promise<DiagResult> {
  await requireOwner();
  try {
    const admin = getAdminClient();
    // listBuckets() richiede service_role: se risponde, la chiave è OK.
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
        message:
          "Bucket 'content-media' non trovato. Crealo dal dashboard Supabase Storage.",
      };
    }
    // Prova upload+delete di un file dummy per verificare le policy.
    const path = `media/_diag/${Date.now()}.txt`;
    const { error: upErr } = await admin.storage
      .from("content-media")
      .upload(path, new Uint8Array([0x6f, 0x6b]), {
        contentType: "text/plain",
        upsert: false,
      });
    if (upErr) {
      return {
        ok: false,
        message: `Upload fallito: ${upErr.message}. Verifica policy RLS su storage.objects.`,
      };
    }
    await admin.storage.from("content-media").remove([path]);
    return { ok: true, message: "Bucket content-media OK (upload+delete riuscito)." };
  } catch (err) {
    return {
      ok: false,
      message: `Errore Supabase Storage: ${err instanceof Error ? err.message : "sconosciuto"}.`,
    };
  }
}

// ─────────────────────────────────────────────────────────── Satori / resvg
export async function testTemplateRenderAction(): Promise<DiagResult> {
  await requireOwner();
  try {
    const { renderTemplateToPng, getTemplateDefinition } = await import(
      "@/modules/m04-media/public"
    );
    // Prendi il primo template con il minimo di campi richiesti.
    const def = getTemplateDefinition("promo-announce");
    if (!def) return { ok: false, message: "Template di test 'promo-announce' non trovato." };
    const fields: Record<string, string> = {};
    for (const f of def.fields) fields[f.key] = f.required ? "Test" : "";
    const { pngBytes, width, height } = await renderTemplateToPng("promo-announce", {
      brandDisplayName: "Test Brand",
      brandColor: "#a84a2d",
      brandLogoUrl: null,
      fields,
    });
    return {
      ok: true,
      message: `Rendering OK — PNG ${width}×${height}, ${pngBytes.byteLength} byte.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Rendering template fallito: ${err instanceof Error ? err.message : "sconosciuto"}. Spesso significa che il font-loader non riesce a scaricare i font (cdn.jsdelivr.net bloccato) o che resvg non è disponibile su Vercel.`,
    };
  }
}
