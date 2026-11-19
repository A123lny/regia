// RN-robot: offer M06 (create/update via upsert), ordini M01 (list),
// analytics M08 (contatti/ordini/loyalty).

import { z } from "zod";
import { upsertOfferAction, listOffers } from "@/modules/m06-loyalty/public";
import { listOrders } from "@/modules/m01-data-hub/public";
import {
  getContactsAnalytics,
  getOrdersAnalytics,
  getLoyaltyAnalytics,
  getOutreachAnalytics,
} from "@/modules/m08-analytics/public";
import type { RobotTool } from "./tool-types";

// ============================================================
// Lista offer (letture)
// ============================================================
const ListOffersSchema = z.object({
  includeInactive: z.boolean().optional().default(false),
});

export const listOffersTool: RobotTool = {
  name: "listOffers",
  description:
    "Lista le offer (coupon/sconti configurati in catalogo loyalty M06). Ogni offer e' il template per emettere voucher: nome, rewardKind (valore_fisso/percentuale/servizio_gratis), scadenza giorni default. Usalo per 'quali offer ho?', 'offer attive'.",
  input_schema: {
    type: "object",
    properties: {
      includeInactive: { type: "boolean", description: "Includi offer disattivate" },
    },
    additionalProperties: false,
  },
  requiredCapability: null,
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = ListOffersSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const offers = await listOffers(ctx.session.organizationId, parsed.data.includeInactive);
    return {
      total: offers.length,
      offers: offers.map((o) => ({
        id: o.id,
        name: o.name,
        rewardKind: o.rewardKind,
        rewardValueCents: o.rewardValueCents,
        rewardPct: o.rewardPct,
        rewardLabel: o.rewardLabel,
        defaultExpiresDays: o.defaultExpiresDays,
        isActive: o.isActive,
      })),
    };
  },
};

// ============================================================
// Create offer (via upsert senza offerId)
// ============================================================
const CreateOfferSchema = z
  .object({
    issuerBrandId: z.string().uuid(),
    spendableBrandId: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().max(500).optional(),
    rewardKind: z.enum(["valore_fisso", "percentuale", "servizio_gratis"]),
    rewardValueCents: z.number().int().min(0).optional(),
    rewardPct: z.number().int().min(1).max(100).optional(),
    rewardLabel: z.string().max(100).optional(),
    defaultExpiresDays: z.number().int().min(1).max(365).default(30),
    cumulable: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine(
    (d) =>
      (d.rewardKind === "valore_fisso" && d.rewardValueCents !== undefined) ||
      (d.rewardKind === "percentuale" && d.rewardPct !== undefined) ||
      (d.rewardKind === "servizio_gratis" && d.rewardLabel !== undefined),
    { message: "reward incoerente con rewardKind" },
  );

export const createOfferTool: RobotTool = {
  name: "createOffer",
  description:
    "Crea una nuova offer (template coupon). rewardKind: 'valore_fisso' (richiede rewardValueCents), 'percentuale' (rewardPct 1-100), 'servizio_gratis' (rewardLabel testo). issuerBrandId = chi emette, spendableBrandId = dove si può usare (spesso lo stesso). Confirm obbligatorio.",
  input_schema: {
    type: "object",
    properties: {
      issuerBrandId: { type: "string", description: "UUID brand emittente" },
      spendableBrandId: {
        type: "string",
        description: "UUID brand dove si può spendere (spesso uguale a issuer)",
      },
      name: { type: "string", description: "Nome offer (es. 'Sconto 10% nuovi iscritti')" },
      description: { type: "string" },
      rewardKind: {
        type: "string",
        enum: ["valore_fisso", "percentuale", "servizio_gratis"],
      },
      rewardValueCents: {
        type: "integer",
        minimum: 0,
        description: "Centesimi di sconto (solo se valore_fisso)",
      },
      rewardPct: {
        type: "integer",
        minimum: 1,
        maximum: 100,
        description: "Percentuale 1-100 (solo se percentuale)",
      },
      rewardLabel: { type: "string", description: "Etichetta servizio (solo se servizio_gratis)" },
      defaultExpiresDays: { type: "integer", minimum: 1, maximum: 365 },
      cumulable: { type: "boolean" },
      isActive: { type: "boolean" },
    },
    required: ["issuerBrandId", "spendableBrandId", "name", "rewardKind"],
    additionalProperties: false,
  },
  requiredCapability: "loyalty.crud.offers",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = CreateOfferSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const d = parsed.data;
    const result = await upsertOfferAction({
      issuerBrandId: d.issuerBrandId,
      spendableBrandId: d.spendableBrandId,
      name: d.name,
      rewardKind: d.rewardKind,
      defaultExpiresDays: d.defaultExpiresDays,
      cumulable: d.cumulable,
      isActive: d.isActive,
      ...(d.description && { description: d.description }),
      ...(d.rewardValueCents !== undefined && { rewardValueCents: d.rewardValueCents }),
      ...(d.rewardPct !== undefined && { rewardPct: d.rewardPct }),
      ...(d.rewardLabel && { rewardLabel: d.rewardLabel }),
    });
    if (!result.ok) return { error: "creazione_fallita", message: result.error };
    return {
      ok: true,
      offerId: result.offerId,
      message: `Offer "${d.name}" creata.`,
    };
  },
};

// ============================================================
// Lista ordini
// ============================================================
const ListOrdersSchema = z.object({
  brandId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  channel: z
    .enum(["delivery", "pickup", "store", "officina", "carburante", "online", "altro"])
    .optional(),
  status: z.enum(["pending", "completed", "cancelled", "refunded"]).optional(),
  fromIso: z.string().datetime().optional(),
  toIso: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(50).optional().default(30),
});

export const listOrdersTool: RobotTool = {
  name: "listOrders",
  description:
    "Lista gli ordini. Filtri: brandId, contactId (ordini di un contatto specifico), channel (delivery/pickup/store/officina/carburante/online/altro), status (pending/completed/cancelled/refunded), fromIso/toIso (range ISO 8601). Usalo per 'ordini di oggi', 'ordini di Mario', 'vendite carburante ultima settimana'.",
  input_schema: {
    type: "object",
    properties: {
      brandId: { type: "string" },
      contactId: { type: "string" },
      channel: {
        type: "string",
        enum: ["delivery", "pickup", "store", "officina", "carburante", "online", "altro"],
      },
      status: {
        type: "string",
        enum: ["pending", "completed", "cancelled", "refunded"],
      },
      fromIso: { type: "string", description: "ISO datetime inclusivo" },
      toIso: { type: "string", description: "ISO datetime esclusivo" },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
    additionalProperties: false,
  },
  requiredCapability: null,
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = ListOrdersSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const p = parsed.data;
    const brandId = p.brandId ?? ctx.pageContext.brandId ?? undefined;
    const result = await listOrders({
      organizationId: ctx.session.organizationId,
      ...(brandId && { brandId }),
      ...(p.contactId && { contactId: p.contactId }),
      ...(p.channel && { channel: p.channel }),
      ...(p.status && { status: p.status }),
      ...(p.fromIso && { fromIso: p.fromIso }),
      ...(p.toIso && { toIso: p.toIso }),
      limit: p.limit,
    });
    return {
      total: result.totalCount,
      returned: result.items.length,
      orders: result.items.map((o) => ({
        id: o.id,
        channel: o.channel,
        status: o.status,
        totalCents: o.totalCents,
        totalEuros: Math.round(o.totalCents) / 100,
        placedAt: o.placedAt,
        completedAt: o.completedAt,
        contactId: o.contactId,
      })),
    };
  },
};

// ============================================================
// Analytics stats
// ============================================================
const AnalyticsSchema = z.object({
  topic: z.enum(["contacts", "orders", "loyalty", "outreach"]),
  period: z.enum(["7d", "30d", "90d"]).optional().default("30d"),
});

export const getAnalyticsTool: RobotTool = {
  name: "getAnalytics",
  description:
    "Ritorna le metriche aggregate di dominio per un periodo (7d/30d/90d default). topic: 'contacts' (iscritti, consensi), 'orders' (totale vendite, media), 'loyalty' (voucher emessi/riscattati, redemption rate), 'outreach' (campagne inviate, bounce). Usalo per 'quanti contatti nuovi questo mese', 'vendite settimana', 'tasso riscatto voucher'.",
  input_schema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        enum: ["contacts", "orders", "loyalty", "outreach"],
      },
      period: { type: "string", enum: ["7d", "30d", "90d"] },
    },
    required: ["topic"],
    additionalProperties: false,
  },
  requiredCapability: null,
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = AnalyticsSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const { topic, period } = parsed.data;
    const orgId = ctx.session.organizationId;
    switch (topic) {
      case "contacts":
        return { topic, period, data: await getContactsAnalytics(orgId, period) };
      case "orders":
        return { topic, period, data: await getOrdersAnalytics(orgId, period) };
      case "loyalty":
        return { topic, period, data: await getLoyaltyAnalytics(orgId) };
      case "outreach":
        return { topic, period, data: await getOutreachAnalytics(orgId) };
    }
  },
};
