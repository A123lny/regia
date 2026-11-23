// M03 — RF-3.4 Corsia veloce comunicazioni di servizio.
// Genera un post di servizio da poche parole del titolare.
// Prompt dedicato: tono asciutto, zero linguaggio promozionale, max 3 righe.

import { getBrandKitWithLists, formatBrandContextForAI } from "@/modules/m02-brand/public";
import { generateText } from "@/lib/ai/gemini";
import { AiTimeoutError, AiRateLimitError, AiApiError } from "@/lib/ai/anthropic";
import { loadPromptTemplate, interpolate } from "./prompt-loader";
import { insertDraft } from "./content-drafts-repo";
import { stripMarkdown } from "./generate-social-post";
import type { ContentDraft } from "./content-drafts-types";

export const SERVICE_PROMPT_VERSION = "service-communication-v1";

function todayLabelIt(): string {
  // Es. "sabato 23 novembre 2026". Usa fuso Europe/Rome (imposto da instrumentation.ts).
  return new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function composeServiceCommunicationPrompt(input: {
  brandDisplayName: string;
  brandContext: string;
  ownerInput: string;
  todayLabel?: string;
}): { systemPrompt: string; userMessage: string } {
  const template = loadPromptTemplate("service-communication");
  const systemPrompt = interpolate(template, {
    brandDisplayName: input.brandDisplayName,
    brandContext: input.brandContext,
    todayLabel: input.todayLabel ?? todayLabelIt(),
  });
  const userMessage =
    "Trasforma questa comunicazione di servizio in un post pronto:\n" +
    `<owner-input>\n${input.ownerInput}\n</owner-input>`;
  return { systemPrompt, userMessage };
}

export type RunGenerateServiceCommunicationInput = {
  organizationId: string;
  brandId: string;
  brandSlug: string;
  brandDisplayName: string;
  ownerInput: string;
  userId: string;
};

export type RunGenerateServiceCommunicationOutput =
  { ok: true; draft: ContentDraft } | { ok: false; error: string };

export async function runGenerateServiceCommunication(
  input: RunGenerateServiceCommunicationInput,
): Promise<RunGenerateServiceCommunicationOutput> {
  // Brand kit obbligatorio
  const bundle = await getBrandKitWithLists(input.brandId);
  if (!bundle) {
    return {
      ok: false,
      error: `Brand kit non configurato. Completa /marchi/${input.brandSlug}`,
    };
  }

  const brandContext = await formatBrandContextForAI(input.brandId);

  const { systemPrompt, userMessage } = composeServiceCommunicationPrompt({
    brandDisplayName: input.brandDisplayName,
    brandContext,
    ownerInput: input.ownerInput,
  });

  let result;
  try {
    result = await generateText({ systemPrompt, userMessage });
  } catch (err) {
    if (err instanceof AiTimeoutError) {
      return {
        ok: false,
        error: "Servizio AI non disponibile (timeout). Riprova tra qualche minuto.",
      };
    }
    if (err instanceof AiRateLimitError) {
      return {
        ok: false,
        error: "Servizio AI ha raggiunto il limite. Riprova tra qualche minuto.",
      };
    }
    if (err instanceof AiApiError) {
      return { ok: false, error: `Servizio AI ha risposto errore ${err.status}. Riprova.` };
    }
    throw err;
  }

  // Prefisso [SERVIZIO] nel theme_input per distinguere dai post marketing.
  // Utile per etichettatura futura (RF-12.3 equilibrio editoriale).
  const themeInput = `[SERVIZIO] ${input.ownerInput.slice(0, 180)}`;

  const draft = await insertDraft({
    organizationId: input.organizationId,
    brandId: input.brandId,
    channel: "social",
    themeInput,
    generatedText: stripMarkdown(result.text).trim(),
    promptVersion: SERVICE_PROMPT_VERSION,
    modelUsed: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    createdBy: input.userId,
  });

  return { ok: true, draft };
}
