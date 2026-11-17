// RN-robot: tool listScheduledContent — contenuti editoriali in coda.

import { z } from "zod";
import {
  listContentDraftsByStatus,
  type ContentDraftStatus,
} from "@/modules/m03-editorial/public";
import type { RobotTool } from "./tool-types";

const InputSchema = z.object({
  status: z
    .enum(["draft", "approved", "rejected", "scheduled", "published"])
    .optional()
    .default("scheduled"),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export const listScheduledContentTool: RobotTool = {
  name: "listScheduledContent",
  description:
    "Lista i contenuti editoriali (post social, email, SMS) dell'organizzazione per stato. Default: 'scheduled' = contenuti in coda per essere pubblicati. Altri stati utili: 'draft' (bozze), 'approved' (approvati non ancora schedulati), 'published'. Max 50 risultati. Includi il brand per ciascuno. SOLO lettura — non pubblica nulla.",
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["draft", "approved", "rejected", "scheduled", "published"],
        description: "Stato dei contenuti da elencare (default 'scheduled').",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        description: "Numero massimo di risultati (default 20).",
      },
    },
    additionalProperties: false,
  },
  requiredCapability: null,
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = InputSchema.safeParse(rawInput ?? {});
    if (!parsed.success) {
      return { error: "input_invalido", details: parsed.error.message };
    }
    const rows = await listContentDraftsByStatus(
      ctx.session.organizationId,
      parsed.data.status as ContentDraftStatus,
      parsed.data.limit,
    );
    return {
      status: parsed.data.status,
      total: rows.length,
      drafts: rows.map((d) => ({
        id: d.id,
        brand: d.brandDisplayName,
        channel: d.channel,
        scheduledAt: d.scheduledAt,
        themeInput: d.themeInput,
        textExcerpt: d.generatedText?.slice(0, 200),
        topicLabel: d.topicLabel,
      })),
    };
  },
};
