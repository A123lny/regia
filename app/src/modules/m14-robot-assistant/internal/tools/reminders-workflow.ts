// RN-robot: gestione reminder M09 esistenti (dismiss, markSent, sendNow).
// La creazione di reminder M09 non e' ad-hoc: i reminder vengono generati da
// trigger business (ordini, quote, abbandono). Per reminder operatore libero
// c'e' createTask M12. Qui esponiamo solo la chiusura/invio di quelli
// esistenti.

import { z } from "zod";
import {
  dismissReminderAction,
  markReminderSentAction,
  sendReminderNowAction,
} from "@/modules/m09-reminders/public";
import type { RobotTool } from "./tool-types";

const ReminderIdSchema = z.object({ reminderId: z.string().uuid() });

// ============================================================
// Dismiss (chiudi senza inviare, es. "mi sono ricordato gia'")
// ============================================================
export const dismissReminderTool: RobotTool = {
  name: "dismissReminder",
  description:
    "Chiude un promemoria esistente senza inviare nulla. Usalo per 'ho gestito io il promemoria X', 'non serve più', 'chiudi il promemoria Y'. Il promemoria passa a stato 'dismissed'.",
  input_schema: {
    type: "object",
    properties: { reminderId: { type: "string", description: "UUID del promemoria" } },
    required: ["reminderId"],
    additionalProperties: false,
  },
  requiredCapability: "reminders.crud",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = ReminderIdSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const result = await dismissReminderAction(parsed.data.reminderId);
    if (!result.ok) return { error: "dismiss_fallito", message: result.error };
    return { ok: true, reminderId: parsed.data.reminderId, message: "Promemoria chiuso." };
  },
};

// ============================================================
// MarkSent (manualmente "ho mandato l'SMS fuori dal sistema")
// ============================================================
export const markReminderSentTool: RobotTool = {
  name: "markReminderSent",
  description:
    "Marca un promemoria come già inviato manualmente (fuori dal sistema). Usalo quando l'utente dice 'ho mandato io l'SMS/email al contatto, chiudi il promemoria X come inviato'. Passa a stato 'sent' senza inviare nulla.",
  input_schema: {
    type: "object",
    properties: { reminderId: { type: "string", description: "UUID del promemoria" } },
    required: ["reminderId"],
    additionalProperties: false,
  },
  requiredCapability: "reminders.crud",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = ReminderIdSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const result = await markReminderSentAction(parsed.data.reminderId);
    if (!result.ok) return { error: "marksent_fallito", message: result.error };
    return { ok: true, reminderId: parsed.data.reminderId, message: "Promemoria marcato come inviato." };
  },
};

// ============================================================
// SendNow (forza invio immediato via publish M05)
// ============================================================
export const sendReminderNowTool: RobotTool = {
  name: "sendReminderNow",
  description:
    "Forza l'invio IMMEDIATO di un promemoria via SMS/email/WhatsApp (bypassa lo scheduling). Usalo solo se l'utente lo chiede esplicitamente: 'manda ora il promemoria X'. Costa budget invii. Confirm obbligatorio.",
  input_schema: {
    type: "object",
    properties: { reminderId: { type: "string", description: "UUID del promemoria" } },
    required: ["reminderId"],
    additionalProperties: false,
  },
  requiredCapability: "publishing.send",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = ReminderIdSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const result = await sendReminderNowAction(parsed.data.reminderId);
    if (!result.ok) return { error: "invio_fallito", message: result.error };
    return {
      ok: true,
      reminderId: parsed.data.reminderId,
      jobId: result.jobId,
      channel: result.channel,
      message: `Invio avviato via ${result.channel}.`,
    };
  },
};
