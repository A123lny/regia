// RN-robot: tool generateContentDraft — variante Gemini (bypass M03 per
// evitare dipendenza da ANTHROPIC_API_KEY, non disponibile sul deploy demo).
//
// Shortcut: la bozza viene creata direttamente in content_drafts via admin
// client. NON passiamo per il motore editoriale M03 che avrebbe:
// - few-shot del tono di voce del brand
// - policy applicate nel pre-prompt
// - audit log dettagliato
//
// Rimangono garantiti: organization+brand scoping, policy capitolato nel
// system prompt, logSpend per budget tracking (category 'anthropic-robot').

import { z } from "zod";
import { getAdminClient } from "@/lib/db/admin";
import { generateText } from "@/lib/ai/gemini";
import {
  logSpend,
  assertBudgetOk,
  AiBudgetExceededError,
  assertAiEnabled,
  AiKillSwitchError,
} from "@/modules/m11-admin/public";
import { logAuditEvent } from "@/lib/audit/log";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  brandId: z.string().uuid(),
  themeInput: z.string().min(2).max(2000),
});

const SYSTEM_PROMPT_BASE = `Sei un copywriter per un ristorante/attività commerciale. Generi un post social (Facebook/Instagram) per il marchio indicato.

VINCOLI (dal capitolato della Regìa, mai derogabili):
- Lingua: italiano.
- Mai sconti sul carburante (RF-6.15).
- Mai sconti sul cibo a carico di Lenny (RF-6.16).
- Mai sconti officina (RF-6.17).
- Niente promozioni senza approvazione umana esplicita (§8.2): se l'utente chiede una promozione, inserisci nel testo un disclaimer tipo "da confermare dal titolare".
- Niente risposte a critiche/recensioni negative: se il tema sembra tale, rispondi con un testo neutro di comunicazione aziendale, non polemico.
- Non inventare orari/prezzi/date non forniti: se mancano, usa frasi generiche.

STILE:
- Tono professionale ma cordiale.
- Max 280 caratteri per il testo principale.
- Include 2-3 hashtag pertinenti alla fine.
- Niente emoji eccessive (max 2).

Output: SOLO il testo del post, pronto per essere copiato nel social. Niente intestazioni, niente spiegazioni.`;

export const generateContentDraftTool: RobotTool = {
  name: "generateContentDraft",
  description:
    "Genera una nuova bozza di contenuto (post social) per un brand usando Gemini. Richiede brandId (chiama prima listBrands se manca) e themeInput (il tema/argomento del post in linguaggio naturale, 2-2000 char). Costa budget AI robot; passa dal confirm flow. La bozza creata va poi approvata/schedulata.",
  input_schema: {
    type: "object",
    properties: {
      brandId: {
        type: "string",
        description: "UUID del brand per cui generare. Usa listBrands per trovarlo.",
      },
      themeInput: {
        type: "string",
        description:
          "Tema del post in linguaggio naturale, es. 'offerta serale pizza margherita a 8€'.",
      },
    },
    required: ["brandId", "themeInput"],
    additionalProperties: false,
  },
  requiredCapability: "content.generate",
  kind: "write",
  execute: async (rawInput, ctx) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }
    const { brandId, themeInput } = parsed.data;
    const { session } = ctx;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = getAdminClient() as any;

    // 1. Verifica ownership brand + prendi info per il prompt
    const { data: brand, error: brandErr } = await admin
      .from("brands")
      .select("id, display_name, organization_id, is_archived")
      .eq("id", brandId)
      .single();
    if (brandErr || !brand) {
      return { error: "brand_non_trovato", message: "Brand non trovato" };
    }
    if (brand.organization_id !== session.organizationId) {
      return { error: "forbidden", message: "Brand non autorizzato" };
    }
    if (brand.is_archived) {
      return { error: "brand_archiviato", message: "Non posso generare per un brand archiviato" };
    }

    // 2a. Kill switch AI globale (RF-11.4)
    try {
      await assertAiEnabled(session.organizationId);
    } catch (err) {
      if (err instanceof AiKillSwitchError) {
        return {
          error: "ai_disabled",
          message: "Le generazioni AI sono state sospese dall'owner.",
        };
      }
      return { error: "ai_check_fail", message: "Controllo kill switch fallito." };
    }

    // 2b. Budget gate
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await assertBudgetOk(session.organizationId, "anthropic-robot" as any);
    } catch (err) {
      if (err instanceof AiBudgetExceededError) {
        return { error: "budget_exceeded", message: "Budget AI robottino esaurito." };
      }
      return { error: "budget_check_fail", message: "Controllo budget fallito." };
    }

    // 3. Genera via Gemini
    const systemPrompt = `${SYSTEM_PROMPT_BASE}\n\nMARCHIO: ${brand.display_name}`;
    let gen: Awaited<ReturnType<typeof generateText>>;
    try {
      gen = await generateText({
        systemPrompt,
        userMessage: `Tema: ${themeInput}`,
        maxTokens: 400,
      });
    } catch (err) {
      return { error: "generazione_fallita", message: err instanceof Error ? err.message : "?" };
    }

    // 4. Insert in content_drafts
    const { data: insertedRaw, error: insertErr } = await admin
      .from("content_drafts")
      .insert({
        organization_id: session.organizationId,
        brand_id: brandId,
        channel: "social",
        theme_input: themeInput,
        generated_text: gen.text,
        prompt_version: "robot-gemini-v1",
        model_used: gen.model,
        tokens_in: gen.tokensIn,
        tokens_out: gen.tokensOut,
        cost_usd: gen.costUsd,
        latency_ms: gen.latencyMs,
        status: "draft",
        created_by: session.userId,
      })
      .select("id")
      .single();
    if (insertErr || !insertedRaw) {
      return { error: "salvataggio_fallito", message: insertErr?.message ?? "insert fail" };
    }
    const inserted = insertedRaw as { id: string };

    // 5. Log spesa
    try {
      await logSpend({
        organizationId: session.organizationId,
        brandId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        category: "anthropic-robot" as any,
        action: "robot.generateContentDraft",
        costUsd: gen.costUsd,
        tokensIn: gen.tokensIn,
        tokensOut: gen.tokensOut,
        targetType: "content_draft",
        targetId: inserted.id,
      });
    } catch {
      /* non bloccante */
    }

    // 6. Audit event dedicato (RF-11.3): oltre a quello generico del tool
    // loop, lasciamo traccia esplicita 'robot.content.generated' con metadata
    // non PII (brand + draft id + model + tokens + costUsd). Data minimization:
    // NO theme_input (puo' contenere info sensibili dell'utente).
    try {
      await logAuditEvent({
        organizationId: session.organizationId,
        actorUserId: session.userId,
        actorKind: "agent",
        action: "robot.content.generated",
        target: `brand:${brandId}`,
        details: {
          source: "robot-assistant",
          draft_id: inserted.id,
          model: gen.model,
          tokens_in: gen.tokensIn,
          tokens_out: gen.tokensOut,
          cost_usd: gen.costUsd,
          theme_input_length: themeInput.length,
        },
      });
    } catch {
      /* non bloccante */
    }

    return {
      ok: true,
      draftId: inserted.id,
      preview: gen.text.slice(0, 200),
      message: `Bozza creata (id ${inserted.id}). Vai in /contenuti per vederla e approvarla.`,
    };
  },
};
