// RN-robot: tool listCampaigns — campagne di outreach (email/SMS massivi).

import { z } from "zod";
import { listCampaigns } from "@/modules/m07-outreach/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  brandId: z.string().uuid().optional(),
  status: z.enum(["draft", "scheduled", "sending", "sent", "cancelled"]).optional(),
});

export const listCampaignsTool: RobotTool = {
  name: "listCampaigns",
  description:
    "Lista le campagne (invii massivi email/SMS). Filtri opzionali: brandId e status (draft/scheduled/sending/sent/cancelled). Usalo per 'quante campagne in coda?', 'campagne già inviate', 'draft da approvare'. SOLO lettura — l'invio richiede approvazione umana via UI, non puoi lanciarle tu.",
  input_schema: {
    type: "object",
    properties: {
      brandId: {
        type: "string",
        description: "UUID del brand (opzionale). Usa listBrands per trovarlo.",
      },
      status: {
        type: "string",
        enum: ["draft", "scheduled", "sending", "sent", "cancelled"],
      },
    },
    additionalProperties: false,
  },
  requiredCapability: "campaign.read",
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }
    const brandId = parsed.data.brandId ?? ctx.pageContext.brandId ?? undefined;
    const rows = await listCampaigns(ctx.session.organizationId, brandId, parsed.data.status);
    return {
      total: rows.length,
      campaigns: rows.map((c) => ({
        id: c.id,
        name: c.name,
        brand: c.brandDisplayName,
        channel: c.channel,
        status: c.status,
        plannedAt: c.plannedAt,
        sentAt: c.sentAt,
        deliveredCount: c.deliveredCount,
        failedCount: c.failedCount,
      })),
    };
  },
};
