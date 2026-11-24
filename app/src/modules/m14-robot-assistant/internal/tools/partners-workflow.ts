// RN-robot: workflow fornitori/partner ristoranti M07.
// list + create/update (via upsert) + archive + logActivity.

import { z } from "zod";
import {
  listPartners,
  upsertPartnerAction,
  archivePartnerAction,
  logActivityAction,
} from "@/modules/m07-partners/public";
import type { RobotTool } from "./tool-types";

// ============================================================
// Lista partner
// ============================================================
const ListSchema = z.object({
  brandId: z.string().uuid().optional(),
  status: z.enum(["mai_partito", "attivo", "sospeso", "uscito"]).optional(),
  coolingOnly: z.boolean().optional(),
});

export const listPartnersTool: RobotTool = {
  name: "listPartners",
  description:
    "Lista i fornitori/partner (ristoranti). Richiede brandId (chiama prima listBrands se manca). Filtri opzionali: status (mai_partito/attivo/sospeso/uscito), coolingOnly (solo quelli in da risentire).",
  input_schema: {
    type: "object",
    properties: {
      brandId: {
        type: "string",
        description: "UUID brand. Usa listBrands per trovarlo.",
      },
      status: {
        type: "string",
        enum: ["mai_partito", "attivo", "sospeso", "uscito"],
      },
      coolingOnly: { type: "boolean" },
    },
    additionalProperties: false,
  },
  requiredCapability: "partner.read",
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = ListSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const brandId = parsed.data.brandId ?? ctx.pageContext.brandId ?? null;
    if (!brandId) {
      return {
        error: "brand_mancante",
        message: "Specifica brandId o chiama prima listBrands.",
      };
    }
    const rows = await listPartners({
      organizationId: ctx.session.organizationId,
      brandId,
      ...(parsed.data.status && { status: parsed.data.status }),
      ...(parsed.data.coolingOnly !== undefined && { coolingOnly: parsed.data.coolingOnly }),
    });
    return {
      total: rows.length,
      partners: rows.slice(0, 20).map((p) => ({
        id: p.id,
        name: p.name,
        cuisineCategory: p.cuisineCategory,
        onboardingStatus: p.onboardingStatus,
        phone: p.phone,
        email: p.email,
        coolingFlag: p.coolingFlag,
        lastContactAt: p.lastContactAt,
      })),
    };
  },
};

// ============================================================
// Create partner (via upsert senza partnerId)
// ============================================================
const CreateSchema = z.object({
  brandId: z.string().uuid(),
  name: z.string().min(1).max(200),
  referentName: z.string().max(100).optional(),
  phone: z.string().min(5).max(30).optional(),
  email: z.string().email().optional(),
  cuisineCategory: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
  onboardingStatus: z
    .enum(["mai_partito", "attivo", "sospeso", "uscito"])
    .optional()
    .default("mai_partito"),
});

export const createPartnerTool: RobotTool = {
  name: "createPartner",
  description:
    "Crea un nuovo fornitore/partner (ristorante). Richiede brandId (chiama listBrands se non lo hai) e name. Opzionali: referentName, phone, email, cuisineCategory, notes, onboardingStatus (default 'mai_partito').",
  input_schema: {
    type: "object",
    properties: {
      brandId: { type: "string", description: "UUID brand" },
      name: { type: "string", description: "Nome ristorante/fornitore" },
      referentName: { type: "string", description: "Nome referente" },
      phone: { type: "string", description: "Telefono" },
      email: { type: "string", description: "Email" },
      cuisineCategory: { type: "string", description: "Categoria cucina" },
      notes: { type: "string", description: "Note libere" },
      onboardingStatus: {
        type: "string",
        enum: ["mai_partito", "attivo", "sospeso", "uscito"],
        description: "Stato onboarding (default 'mai_partito')",
      },
    },
    required: ["brandId", "name"],
    additionalProperties: false,
  },
  requiredCapability: "partner.crud",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = CreateSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const d = parsed.data;
    const result = await upsertPartnerAction({
      brandId: d.brandId,
      name: d.name,
      onboardingStatus: d.onboardingStatus,
      coolingFlag: false,
      ...(d.referentName && { referentName: d.referentName }),
      ...(d.phone && { phone: d.phone }),
      ...(d.email && { email: d.email }),
      ...(d.cuisineCategory && { cuisineCategory: d.cuisineCategory }),
      ...(d.notes && { notes: d.notes }),
    });
    if (!result.ok) return { error: "creazione_fallita", message: result.error };
    return {
      ok: true,
      partnerId: result.partnerId,
      message: `Fornitore "${d.name}" creato.`,
    };
  },
};

// ============================================================
// Archive partner
// ============================================================
const ArchiveSchema = z.object({ partnerId: z.string().uuid() });

export const archivePartnerTool: RobotTool = {
  name: "archivePartner",
  description:
    "Archivia un fornitore. Non viene cancellato fisicamente, viene marcato come archiviato. Confirm obbligatorio.",
  input_schema: {
    type: "object",
    properties: { partnerId: { type: "string", description: "UUID del partner" } },
    required: ["partnerId"],
    additionalProperties: false,
  },
  requiredCapability: "partner.crud",
  kind: "destructive",
  execute: async (rawInput) => {
    const parsed = ArchiveSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    try {
      await archivePartnerAction(parsed.data.partnerId);
      return { ok: true, partnerId: parsed.data.partnerId, message: "Fornitore archiviato." };
    } catch (err) {
      return { error: "archiviazione_fallita", message: err instanceof Error ? err.message : "?" };
    }
  },
};

// ============================================================
// Log partner activity (es. "ho chiamato il fornitore")
// ============================================================
const LogActivitySchema = z.object({
  partnerId: z.string().uuid(),
  kind: z.enum(["chiamata", "incontro", "email", "whatsapp", "follow_up", "segnalazione"]),
  outcome: z.enum(["positivo", "neutro", "negativo", "da_richiamare"]).optional(),
  summary: z.string().min(1).max(2000),
});

export const logPartnerActivityTool: RobotTool = {
  name: "logPartnerActivity",
  description:
    "Registra un'attività (chiamata, incontro, email, whatsapp, follow_up, segnalazione) con un fornitore. Usalo per 'ho chiamato il ristorante X', 'incontro con Y'. summary obbligatorio (descrive cosa è stato detto/fatto).",
  input_schema: {
    type: "object",
    properties: {
      partnerId: { type: "string", description: "UUID del partner" },
      kind: {
        type: "string",
        enum: ["chiamata", "incontro", "email", "whatsapp", "follow_up", "segnalazione"],
      },
      outcome: {
        type: "string",
        enum: ["positivo", "neutro", "negativo", "da_richiamare"],
      },
      summary: {
        type: "string",
        description: "Riassunto dell'attività (1-2000 char, obbligatorio)",
      },
    },
    required: ["partnerId", "kind", "summary"],
    additionalProperties: false,
  },
  requiredCapability: "partner.activity.log",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = LogActivitySchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const d = parsed.data;
    const result = await logActivityAction({
      partnerId: d.partnerId,
      kind: d.kind,
      summary: d.summary,
      ...(d.outcome && { outcome: d.outcome }),
    });
    if (!result.ok) return { error: "log_fallito", message: result.error };
    return {
      ok: true,
      activityId: result.activityId,
      message: `Attività '${d.kind}' registrata.`,
    };
  },
};
