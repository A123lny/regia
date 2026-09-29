// M03 — RF-3.1 Piano editoriale AI multi-post.
// Genera N bozze in sequenza per un marchio, rispettando pesi dei pilastri e
// stagionalità (data slot). Ogni chiamata all'AI riceve il context delle bozze
// già generate nel piano corrente per evitare ripetizioni.
//
// Blocking: la server action gira per la durata dell'intero piano (~1-3 min per
// 14 bozze). In dev locale non c'e timeout; in produzione richiedera BullMQ o
// Edge Functions (nota per F0-b).

import { randomUUID } from "node:crypto";
import { getBrandKitWithLists, formatBrandContextForAI } from "@/modules/m02-brand/public";
import type { BrandPillar } from "@/modules/m02-brand/public";
import { generateText, AiTimeoutError, AiRateLimitError, AiApiError } from "@/lib/ai/anthropic";
import { insertDraft } from "./content-drafts-repo";
import type { ContentDraft } from "./content-drafts-types";

export const PLAN_PROMPT_VERSION = "editorial-plan-v1";

export type PlanGenerationInput = {
  organizationId: string;
  brandId: string;
  brandSlug: string;
  brandDisplayName: string;
  userId: string;
  numDrafts: number; // 5..30, default 14
  startDateIso: string; // ISO local start-of-day
  excludedPillarIds: string[]; // pilastri da NON usare in questo piano
};

export type PlanGenerationResult =
  | {
      ok: true;
      planBatchId: string;
      drafts: ContentDraft[];
      totalCostUsd: number;
    }
  | { ok: false; error: string; partialBatchId?: string; partialDrafts?: ContentDraft[] };

/**
 * Weighted random pick di un pillar in base al suo weight.
 * Un pillar con weight=5 esce 5x piu spesso di uno con weight=1.
 */
function pickWeightedPillar(pillars: BrandPillar[]): BrandPillar {
  const totalWeight = pillars.reduce((s, p) => s + p.weight, 0);
  const target = Math.random() * totalWeight;
  let cumulative = 0;
  for (const p of pillars) {
    cumulative += p.weight;
    if (target <= cumulative) return p;
  }
  const last = pillars[pillars.length - 1];
  if (!last) throw new Error("pickWeightedPillar: array vuoto");
  return last;
}

function addDays(iso: string, n: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDateItalian(d: Date): string {
  return d.toLocaleDateString("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Compone il prompt per una singola bozza del piano.
 * Puro (nessun I/O), testabile.
 */
export function composePlanItemPrompt(input: {
  brandDisplayName: string;
  brandContext: string;
  pillar: BrandPillar;
  slotDate: Date;
  previousItemsSummary: Array<{ dayIndex: number; pillar: string; theme: string }>;
}): { systemPrompt: string; userMessage: string } {
  const dayLabel = formatDateItalian(input.slotDate);

  const systemPrompt =
    `Sei l'assistente editoriale del marchio "${input.brandDisplayName}".\n` +
    `Genera UN post social per il giorno indicato, coerente col brand kit e con il pilastro richiesto.\n\n` +
    `<brand-kit>\n${input.brandContext}\n</brand-kit>\n\n` +
    `REGOLE:\n` +
    `- Rispetta rigorosamente il tono di voce e i vincoli del brand kit.\n` +
    `- Il post appartiene al pilastro "${input.pillar.name}".\n` +
    `- Considera stagionalita e giorno della settimana.\n` +
    `- Non inventare dati concreti (prezzi, date, nomi): se mancano, tieni il post generico o lascia placeholder [DA COMPILARE].\n` +
    `- Non ripetere temi gia usati nei giorni precedenti (elencati sotto).\n\n` +
    `FORMATO DI RISPOSTA (JSON valido, senza altro testo):\n` +
    `{"theme": "descrizione breve del tema (max 100 caratteri)", "post": "testo completo del post social"}\n`;

  const previousSection =
    input.previousItemsSummary.length === 0
      ? "<piano-in-corso>\n(nessun post generato ancora, questo e il primo)\n</piano-in-corso>"
      : "<piano-in-corso>\n" +
        input.previousItemsSummary
          .map((it) => `Giorno ${it.dayIndex + 1} — pilastro "${it.pillar}" — tema: ${it.theme}`)
          .join("\n") +
        "\n</piano-in-corso>";

  const userMessage =
    `Genera il post per:\n` +
    `<slot>\nData: ${dayLabel}\nPilastro: ${input.pillar.name}\n</slot>\n\n` +
    previousSection;

  return { systemPrompt, userMessage };
}

/**
 * Parse robusto della risposta JSON dell'AI.
 * Fallback: se il parsing fallisce, tratta l'intera risposta come "post" con theme = pillar name.
 */
function parsePlanItemResponse(
  text: string,
  fallbackPillarName: string,
): { theme: string; post: string } {
  // Rimuovi eventuali code fence markdown
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as { theme?: string; post?: string };
    if (typeof parsed.post === "string" && parsed.post.length > 0) {
      return {
        theme:
          typeof parsed.theme === "string" && parsed.theme.length > 0
            ? parsed.theme.slice(0, 100)
            : fallbackPillarName,
        post: parsed.post,
      };
    }
  } catch {
    // Fallback below
  }
  return { theme: fallbackPillarName, post: cleaned };
}

export async function runGenerateEditorialPlan(
  input: PlanGenerationInput,
): Promise<PlanGenerationResult> {
  // 1. Brand kit obbligatorio
  const bundle = await getBrandKitWithLists(input.brandId);
  if (!bundle) {
    return {
      ok: false,
      error: `Brand kit non configurato. Completa /marchi/${input.brandSlug} prima di generare un piano.`,
    };
  }

  // 2. Filtra pilastri: escludi quelli richiesti, tieni solo quelli con weight >= 1
  const usablePillars = bundle.pillars.filter(
    (p) => !input.excludedPillarIds.includes(p.id) && p.weight >= 1,
  );
  if (usablePillars.length === 0) {
    return {
      ok: false,
      error:
        "Nessun pilastro disponibile per il piano. Configura almeno un pilastro nel brand kit e non escluderlo tutto.",
    };
  }

  // 3. Brand context (Markdown, fidato)
  const brandContext = await formatBrandContextForAI(input.brandId);

  // 4. Loop sequenziale: N chiamate AI con context accumulato
  const planBatchId = randomUUID();
  const drafts: ContentDraft[] = [];
  const summary: Array<{ dayIndex: number; pillar: string; theme: string }> = [];
  let totalCostUsd = 0;

  for (let i = 0; i < input.numDrafts; i++) {
    const pillar = pickWeightedPillar(usablePillars);
    const slotDate = addDays(input.startDateIso, i);

    const { systemPrompt, userMessage } = composePlanItemPrompt({
      brandDisplayName: input.brandDisplayName,
      brandContext,
      pillar,
      slotDate,
      previousItemsSummary: summary,
    });

    let result;
    try {
      result = await generateText({ systemPrompt, userMessage });
    } catch (err) {
      // Errori AI: interrompe il piano ma non perde i draft gia creati
      let errMsg = "Errore imprevisto";
      if (err instanceof AiTimeoutError) errMsg = "Timeout servizio AI";
      else if (err instanceof AiRateLimitError) errMsg = "Rate limit AI raggiunto";
      else if (err instanceof AiApiError) errMsg = `AI error ${err.status}`;
      else if (err instanceof Error) errMsg = err.message;
      return {
        ok: false,
        error: `Piano interrotto al draft ${i + 1}/${input.numDrafts}: ${errMsg}. Le ${i} bozze gia create restano in stato draft.`,
        partialBatchId: planBatchId,
        partialDrafts: drafts,
      };
    }

    const parsed = parsePlanItemResponse(result.text, pillar.name);
    const dayLabel = formatDateItalian(slotDate);
    const themeInput = `[${pillar.name}] ${parsed.theme} — ${dayLabel}`;

    const draft = await insertDraft({
      organizationId: input.organizationId,
      brandId: input.brandId,
      channel: "social",
      themeInput,
      generatedText: parsed.post,
      promptVersion: PLAN_PROMPT_VERSION,
      modelUsed: result.model,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd: result.costUsd,
      latencyMs: result.latencyMs,
      createdBy: input.userId,
      planBatchId,
    });

    drafts.push(draft);
    summary.push({ dayIndex: i, pillar: pillar.name, theme: parsed.theme });
    totalCostUsd += result.costUsd;
  }

  return { ok: true, planBatchId, drafts, totalCostUsd };
}
