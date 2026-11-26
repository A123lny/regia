// Wrapper server-only su REST API Creatomate.
// Auth: Authorization: Bearer CREATOMATE_API_KEY.
// Endpoint confermati:
//   POST /v2/renders  → crea render (body: { template_id, modifications, webhook_url, metadata, ... })
//   GET  /v2/renders/:id  → stato render
//   GET  /v2/templates  → lista template del progetto (auth-scoped)
//
// Errori mappati a messaggi IT. Retry esponenziale su 429/5xx (max 3).

import "server-only";
import { CREATOMATE_API_BASE, CREATOMATE_API_KEY_ENV } from "./config";

// ────────────────────────────────────────────────────────────────────────
// Errori tipati
// ────────────────────────────────────────────────────────────────────────

export class CreatomateError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CreatomateError";
    this.status = status;
  }
}

export class CreatomateConfigError extends CreatomateError {
  constructor(message = "Chiave Creatomate non impostata. Impostala su Vercel e rifai il deploy.") {
    super(0, message);
    this.name = "CreatomateConfigError";
  }
}

export class CreatomateCreditsExhaustedError extends CreatomateError {
  constructor(message = "Crediti Creatomate esauriti. Ricarica il piano o aspetta il rinnovo.") {
    super(402, message);
    this.name = "CreatomateCreditsExhaustedError";
  }
}

export class CreatomateRateLimitError extends CreatomateError {
  constructor(message = "Troppe richieste a Creatomate. Riprova fra qualche secondo.") {
    super(429, message);
    this.name = "CreatomateRateLimitError";
  }
}

export class CreatomateTemplateNotFoundError extends CreatomateError {
  constructor(templateId: string) {
    super(404, `Template Creatomate "${templateId}" non trovato o non accessibile.`);
    this.name = "CreatomateTemplateNotFoundError";
  }
}

export class CreatomateValidationError extends CreatomateError {
  constructor(detail: string) {
    super(400, `Richiesta a Creatomate non valida: ${detail}`);
    this.name = "CreatomateValidationError";
  }
}

// ────────────────────────────────────────────────────────────────────────
// Tipi API
// ────────────────────────────────────────────────────────────────────────

export type CreatomateRenderStatus =
  | "planned"
  | "queued"
  | "waiting"
  | "transcribing"
  | "rendering"
  | "succeeded"
  | "failed"
  | "cancelled";

export type CreatomateRenderResponse = {
  id: string;
  status: CreatomateRenderStatus;
  url?: string | null;
  snapshot_url?: string | null;
  template_id?: string | null;
  output_format?: string | null;
  width?: number | null;
  height?: number | null;
  frame_rate?: number | null;
  duration?: number | null;
  error_message?: string | null;
  metadata?: unknown;
};

export type CreatomateTemplate = {
  id: string;
  name: string;
  width?: number;
  height?: number;
  duration?: number;
  frame_rate?: number;
  tags?: string[];
};

// ────────────────────────────────────────────────────────────────────────
// Config / helpers
// ────────────────────────────────────────────────────────────────────────

function getKey(): string {
  const k = process.env[CREATOMATE_API_KEY_ENV];
  if (!k || k.trim().length === 0) throw new CreatomateConfigError();
  return k.trim();
}

// isCreatomateKeyPresent è stata spostata in ./config.ts (client-safe barrel):
// doveva essere importabile da public.ts senza trascinare "server-only"
// di questo file nel bundle client.
// Vedi public.ts del modulo m15-creatomate.

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 600;
const REQ_TIMEOUT_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJsonWithRetry(url: string, init: RequestInit): Promise<unknown> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQ_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      const text = await res.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      if (res.ok) return body;

      // Mappatura status
      if (res.status === 401 || res.status === 403) {
        throw new CreatomateConfigError("Chiave Creatomate non valida o revocata.");
      }
      if (res.status === 402) throw new CreatomateCreditsExhaustedError();
      if (res.status === 404) {
        const bodyObj = body as { message?: string } | null;
        throw new CreatomateError(404, bodyObj?.message ?? "Risorsa Creatomate non trovata.");
      }
      if (res.status === 429) {
        if (attempt < MAX_ATTEMPTS) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
          continue;
        }
        throw new CreatomateRateLimitError();
      }
      if (res.status >= 500) {
        if (attempt < MAX_ATTEMPTS) {
          await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
          continue;
        }
        throw new CreatomateError(
          res.status,
          `Creatomate ha risposto con errore ${res.status}. Riprova.`,
        );
      }
      // 400 ecc.
      const bodyObj = body as { message?: string; error?: string } | null;
      const detail =
        bodyObj?.message ?? bodyObj?.error ?? text.slice(0, 200) ?? "payload rifiutato";
      throw new CreatomateValidationError(detail);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof CreatomateError) throw err;
      lastErr = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt - 1));
        continue;
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new CreatomateError(504, "Timeout nella richiesta a Creatomate. Riprova.");
      }
      throw new CreatomateError(
        0,
        `Errore di rete verso Creatomate: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  throw lastErr instanceof Error ? lastErr : new CreatomateError(500, "Errore Creatomate.");
}

// ────────────────────────────────────────────────────────────────────────
// API: createRender
// ────────────────────────────────────────────────────────────────────────

export type CreateRenderInput = {
  // Specifica UNA fra templateId (template registrato in Creatomate) o
  // source (RenderScript JSON inline — permette di creare render senza
  // template preregistrato, utile per i default della piattaforma).
  templateId?: string;
  source?: Record<string, unknown>;
  modifications?: Record<string, unknown>;
  webhookUrl: string;
  metadata?: Record<string, unknown>;
  // Forza dimensioni (preset test). Ignorate se `source` include già w/h.
  width?: number;
  height?: number;
  frameRate?: number;
  outputFormat?: "mp4" | "jpg" | "png" | "gif" | "webp";
};

export async function createRender(input: CreateRenderInput): Promise<CreatomateRenderResponse> {
  if (!input.templateId && !input.source) {
    throw new CreatomateValidationError(
      "Necessario specificare o templateId o source (RenderScript JSON).",
    );
  }
  const body: Record<string, unknown> = {
    webhook_url: input.webhookUrl,
  };
  if (input.templateId) body["template_id"] = input.templateId;
  if (input.source) body["source"] = input.source;
  if (input.modifications) body["modifications"] = input.modifications;
  if (input.metadata) body["metadata"] = JSON.stringify(input.metadata).slice(0, 2000);
  if (input.width) body["width"] = input.width;
  if (input.height) body["height"] = input.height;
  if (input.frameRate) body["frame_rate"] = input.frameRate;
  if (input.outputFormat) body["output_format"] = input.outputFormat;

  const data = (await fetchJsonWithRetry(`${CREATOMATE_API_BASE}/renders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })) as CreatomateRenderResponse | CreatomateRenderResponse[];
  // La API in alcune versioni ritorna un array di render (uno per output_format).
  const first = Array.isArray(data) ? data[0] : data;
  if (!first || typeof first.id !== "string") {
    throw new CreatomateError(502, "Creatomate ha restituito una risposta inattesa (manca id).");
  }
  return first;
}

// ────────────────────────────────────────────────────────────────────────
// API: getRender
// ────────────────────────────────────────────────────────────────────────

export async function getRender(externalId: string): Promise<CreatomateRenderResponse> {
  // encodeURIComponent anti path-injection: il caller dovrebbe già validare
  // che sia un UUID, questo è defense-in-depth.
  const data = (await fetchJsonWithRetry(
    `${CREATOMATE_API_BASE}/renders/${encodeURIComponent(externalId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${getKey()}` },
    },
  )) as CreatomateRenderResponse;
  if (!data || typeof data.id !== "string") {
    throw new CreatomateError(502, "Creatomate ha restituito una risposta inattesa.");
  }
  return data;
}

// ────────────────────────────────────────────────────────────────────────
// API: listTemplates
// ────────────────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<CreatomateTemplate[]> {
  const data = (await fetchJsonWithRetry(`${CREATOMATE_API_BASE}/templates`, {
    method: "GET",
    headers: { Authorization: `Bearer ${getKey()}` },
  })) as CreatomateTemplate[] | { data?: CreatomateTemplate[] };
  if (Array.isArray(data)) return data;
  if (data && Array.isArray((data as { data?: CreatomateTemplate[] }).data)) {
    return (data as { data: CreatomateTemplate[] }).data;
  }
  return [];
}
