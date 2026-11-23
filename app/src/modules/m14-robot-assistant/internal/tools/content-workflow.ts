// RN-robot: workflow bozze contenuti — approva, rifiuta, schedula, elimina.
// Delega alle Server Action di m03 che applicano RLS + capability.
// Tutte kind='write' o 'destructive' -> confirm flow.

import { z } from "zod";
import {
  approveContentDraft,
  rejectContentDraft,
  scheduleContentDraft,
  deleteContentDraft,
} from "@/modules/m03-editorial/public";
import type { RobotTool } from "./tool-types";

// ============================================================
// Approva bozza
// ============================================================
// reviewedText NON e' fornito dall'LLM (non appare nel input_schema esposto al
// modello). Lo inietta chat-action.ts prima di savePending, catturando il
// testo visto al momento della proposta. L'execute usa quello snapshot, cosi'
// l'approvazione e' legata al testo che il robottino ha presentato all'utente.
const ApproveSchema = z.object({
  draftId: z.string().uuid(),
  reviewedText: z.string().min(1).max(5000),
});

export const approveContentDraftTool: RobotTool = {
  name: "approveContentDraft",
  description:
    "Approva una bozza di contenuto. La bozza passa da 'draft' a 'approved' (pronta per essere schedulata). Richiede draftId (UUID). La bozza deve essere ancora in stato 'draft'.",
  input_schema: {
    type: "object",
    properties: { draftId: { type: "string", description: "UUID bozza" } },
    required: ["draftId"],
    additionalProperties: false,
  },
  requiredCapability: "content.approve",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = ApproveSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      // Se arriva senza reviewedText, qualcosa e' andato storto nella pipeline
      // di snapshot (es. pending creata in versione vecchia). Fail-closed.
      return { error: "snapshot_mancante", details: parsed.error.message };
    }
    try {
      await approveContentDraft(parsed.data.draftId, parsed.data.reviewedText);
      return { ok: true, draftId: parsed.data.draftId, message: "Bozza approvata." };
    } catch (err) {
      return { error: "approvazione_fallita", message: err instanceof Error ? err.message : "?" };
    }
  },
};

// ============================================================
// Rifiuta bozza
// ============================================================
const RejectSchema = z.object({
  draftId: z.string().uuid(),
  reason: z.string().min(1).max(500),
});

export const rejectContentDraftTool: RobotTool = {
  name: "rejectContentDraft",
  description:
    "Rifiuta una bozza di contenuto. Richiede motivazione (1-500 char). La bozza passa a 'rejected'. Usalo quando l'utente dice 'rifiuta la bozza X perché Y'.",
  input_schema: {
    type: "object",
    properties: {
      draftId: { type: "string", description: "UUID bozza" },
      reason: { type: "string", description: "Motivo del rifiuto (1-500 char)" },
    },
    required: ["draftId", "reason"],
    additionalProperties: false,
  },
  requiredCapability: "content.reject",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = RejectSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    try {
      await rejectContentDraft(parsed.data.draftId, parsed.data.reason);
      return { ok: true, draftId: parsed.data.draftId, message: "Bozza rifiutata." };
    } catch (err) {
      return { error: "rifiuto_fallito", message: err instanceof Error ? err.message : "?" };
    }
  },
};

// ============================================================
// Schedula bozza
// ============================================================
const ScheduleSchema = z.object({
  draftId: z.string().uuid(),
  scheduledAt: z.string().max(40),
});

function normalizeScheduledAt(raw: string): string | null {
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (dateOnly) {
    const d2 = new Date(`${raw}T18:00:00+01:00`);
    if (!isNaN(d2.getTime())) return d2.toISOString();
  }
  return null;
}

export const scheduleContentDraftTool: RobotTool = {
  name: "scheduleContentDraft",
  description:
    "Schedula una bozza approvata per la pubblicazione a una data/ora specifica. La bozza deve essere in stato 'approved'. scheduledAt in ISO 8601 (es. '2026-11-25T18:00:00Z') o date-only YYYY-MM-DD (default ora 18:00).",
  input_schema: {
    type: "object",
    properties: {
      draftId: { type: "string", description: "UUID bozza" },
      scheduledAt: { type: "string", description: "Data pubblicazione ISO 8601 o YYYY-MM-DD" },
    },
    required: ["draftId", "scheduledAt"],
    additionalProperties: false,
  },
  requiredCapability: "content.publish",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = ScheduleSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const iso = normalizeScheduledAt(parsed.data.scheduledAt);
    if (!iso) {
      return {
        error: "data_invalida",
        message: `Non ho capito la data "${parsed.data.scheduledAt}".`,
      };
    }
    try {
      await scheduleContentDraft(parsed.data.draftId, iso);
      return {
        ok: true,
        draftId: parsed.data.draftId,
        scheduledAt: iso,
        message: `Bozza schedulata per ${new Date(iso).toLocaleString("it-IT")}.`,
      };
    } catch (err) {
      return { error: "scheduling_fallito", message: err instanceof Error ? err.message : "?" };
    }
  },
};

// ============================================================
// Elimina bozza
// ============================================================
const DeleteSchema = z.object({ draftId: z.string().uuid() });

export const deleteContentDraftTool: RobotTool = {
  name: "deleteContentDraft",
  description:
    "Elimina una bozza. Vietato eliminare bozze gia' pubblicate (il sistema rifiuta). Confirm obbligatorio.",
  input_schema: {
    type: "object",
    properties: { draftId: { type: "string", description: "UUID bozza" } },
    required: ["draftId"],
    additionalProperties: false,
  },
  requiredCapability: "content.delete",
  kind: "destructive",
  execute: async (rawInput) => {
    const parsed = DeleteSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    try {
      await deleteContentDraft(parsed.data.draftId);
      return { ok: true, draftId: parsed.data.draftId, message: "Bozza eliminata." };
    } catch (err) {
      return { error: "eliminazione_fallita", message: err instanceof Error ? err.message : "?" };
    }
  },
};
