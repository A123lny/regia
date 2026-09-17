// M03 — Orchestrazione generazione singolo post social (RF-3.3, RF-3.8).
// Compose prompt puro + call adapter AI + persistenza draft.
//
// Convenzione nomi:
// - composeSocialPostPrompt = funzione pura testabile (injection guard, RA-8.7)
// - runGenerateSocialPost = orchestrazione (impura: chiama repo e adapter)
// La server action generateSocialPost in actions.ts chiama runGenerateSocialPost.

import { getBrandKitWithLists, formatBrandContextForAI } from "@/modules/m02-brand/public";
import { generateText, AiTimeoutError, AiRateLimitError, AiApiError } from "@/lib/ai/anthropic";
import { embedText, VoyageApiError, VoyageTimeoutError, VoyageConfigError } from "@/lib/ai/voyage";
import { loadPromptTemplate, interpolate } from "./prompt-loader";
import {
  insertDraft,
  fetchRecentApprovedByBrand,
  fetchSimilarRejectionsByBrand,
} from "./content-drafts-repo";
import type { ContentDraft } from "./content-drafts-types";

export const PROMPT_VERSION = "social-post-v1";

export type ComposePromptInput = {
  brandDisplayName: string;
  brandContext: string;
  approvedExamples: Array<{ themeInput: string; generatedText: string }>;
  rejections: Array<{ themeInput: string; generatedText: string; rejectionReason: string }>;
  themeInput: string;
};

// Funzione pura: nessun I/O, nessun side-effect. Deterministica.
// Il chiamante è responsabile di aver popolato correttamente approvedExamples
// e rejections (dal repo). Nessuna sanitizzazione: i marker XML sono l'unico
// guardrail (RA-8.7). Input Owner è fidato in F1.5a ma il pattern è testato
// perché diventerà critico in RF-8 (recensioni non fidate).
export function composeSocialPostPrompt(input: ComposePromptInput): {
  systemPrompt: string;
  userMessage: string;
} {
  const template = loadPromptTemplate("social-post");

  const approvedSection =
    input.approvedExamples.length === 0
      ? ""
      : "<esempi-approvati-recenti>\n" +
        input.approvedExamples
          .map((e, i) => `${i + 1}. Tema: ${e.themeInput}\n   Post: ${e.generatedText}`)
          .join("\n\n") +
        "\n</esempi-approvati-recenti>";

  const rejectionsSection =
    input.rejections.length === 0
      ? ""
      : "<anti-pattern-recenti>\n" +
        input.rejections
          .map(
            (r, i) =>
              `${i + 1}. Tema: ${r.themeInput}\n   Post proposto: ${r.generatedText}\n   Motivo rifiuto: ${r.rejectionReason}`,
          )
          .join("\n\n") +
        "\n</anti-pattern-recenti>";

  const systemPrompt = interpolate(template, {
    brandDisplayName: input.brandDisplayName,
    brandContext: input.brandContext,
    recentApprovedExamples: approvedSection,
    recentRejectionsAntipatterns: rejectionsSection,
  });

  const userMessage =
    "Genera un post social per questa richiesta del titolare:\n" +
    `<owner-input>\n${input.themeInput}\n</owner-input>`;

  return { systemPrompt, userMessage };
}

export type RunGenerateSocialPostInput = {
  organizationId: string;
  brandId: string;
  brandSlug: string;
  brandDisplayName: string;
  themeInput: string;
  userId: string;
};

export type RunGenerateSocialPostOutput =
  { ok: true; draft: ContentDraft } | { ok: false; error: string };

export async function runGenerateSocialPost(
  input: RunGenerateSocialPostInput,
): Promise<RunGenerateSocialPostOutput> {
  // 1. Brand kit obbligatorio
  const bundle = await getBrandKitWithLists(input.brandId);
  if (!bundle) {
    return {
      ok: false,
      error: `Brand kit non configurato. Completa /marchi/${input.brandSlug}`,
    };
  }

  // 2. Brand context (Markdown, fidato, no marker)
  const brandContext = await formatBrandContextForAI(input.brandId);

  // 3. Esempi approvati recenti (potrebbero essere 0 all'inizio)
  const approvedExamples = await fetchRecentApprovedByBrand(input.brandId, 3);

  // 4. Embedding tema Owner per retrieval anti-pattern.
  //    Fallback RNF-9: se Voyage è down, non configurata, o l'embedding fallisce
  //    per qualsiasi motivo "Voyage-related", procediamo senza anti-pattern.
  //    Config missing (VOYAGE_API_KEY vuota) è un caso legittimo: F1.5a può
  //    girare senza retrieval, che diventa utile solo con un corpus di rifiuti.
  let rejections: Array<{ themeInput: string; generatedText: string; rejectionReason: string }> =
    [];
  try {
    const emb = await embedText({ text: input.themeInput });
    rejections = await fetchSimilarRejectionsByBrand(input.brandId, emb.embedding, 3);
  } catch (err) {
    if (
      err instanceof VoyageApiError ||
      err instanceof VoyageTimeoutError ||
      err instanceof VoyageConfigError
    ) {
      console.warn(
        "[m03] Voyage embedding non disponibile, procedo senza anti-pattern:",
        (err as Error).message,
      );
    } else {
      throw err; // errore imprevisto propaga
    }
  }

  // 5. Compose prompt (funzione pura)
  const { systemPrompt, userMessage } = composeSocialPostPrompt({
    brandDisplayName: input.brandDisplayName,
    brandContext,
    approvedExamples,
    rejections,
    themeInput: input.themeInput,
  });

  // 6. Call Anthropic. Fallback su errore: NON salva draft (RNF-9).
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

  // 7. Salva draft
  const draft = await insertDraft({
    organizationId: input.organizationId,
    brandId: input.brandId,
    channel: "social",
    themeInput: input.themeInput,
    generatedText: result.text,
    promptVersion: PROMPT_VERSION,
    modelUsed: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    createdBy: input.userId,
  });

  return { ok: true, draft };
}
