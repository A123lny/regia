// RN-robot: segmenti (lettura) + voucher (lista, emissione).
// Due domini accoppiati perche' entrambi legati a contatti:
// - Segmenti M07: gruppi dinamici di contatti (filtri su consensi/ordini/attivita').
// - Voucher M06: emissione agganciata a contatto + offer.

import { z } from "zod";
import { listSegments } from "@/modules/m07-outreach/public";
import { issueVoucherAction, listVouchers } from "@/modules/m06-loyalty/public";
import type { RobotTool } from "./tool-types";

// ============================================================
// Lista segmenti
// ============================================================
const ListSegmentsSchema = z.object({
  includeInactive: z.boolean().optional().default(false),
});

export const listSegmentsTool: RobotTool = {
  name: "listSegments",
  description:
    "Lista i segmenti (gruppi dinamici di contatti) dell'organizzazione. Ogni segmento ha un filtro su consensi/ordini/attività e un count aggiornato. Usalo per 'quali segmenti ho?', 'segmento clienti VIP', 'quanti contatti nel segmento X'.",
  input_schema: {
    type: "object",
    properties: {
      includeInactive: {
        type: "boolean",
        description: "Include anche i segmenti disattivati (default false).",
      },
    },
    additionalProperties: false,
  },
  requiredCapability: "segment.read",
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = ListSegmentsSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const rows = await listSegments(ctx.session.organizationId, parsed.data.includeInactive);
    return {
      total: rows.length,
      segments: rows.map((s) => ({
        id: s.id,
        name: s.name,
        brand: s.brandDisplayName,
        contactCount: s.contactCountMaterialized,
        isActive: s.isActive,
        description: s.description,
      })),
    };
  },
};

// ============================================================
// Lista voucher
// ============================================================
const ListVouchersSchema = z.object({
  status: z.enum(["issued", "redeemed", "cancelled", "expired"]).optional(),
  contactId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).optional().default(30),
});

export const listVouchersTool: RobotTool = {
  name: "listVouchers",
  description:
    "Lista i voucher dell'organizzazione. Filtri: status (issued/redeemed/cancelled/expired), contactId (solo voucher di un contatto specifico). Usalo per 'voucher attivi', 'voucher riscattati', 'voucher di Mario Rossi'.",
  input_schema: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["issued", "redeemed", "cancelled", "expired"],
      },
      contactId: { type: "string", description: "UUID contatto (opzionale)" },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
    additionalProperties: false,
  },
  requiredCapability: "loyalty.read",
  kind: "read",
  execute: async (rawInput, ctx) => {
    const parsed = ListVouchersSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const result = await listVouchers({
      organizationId: ctx.session.organizationId,
      ...(parsed.data.status && { status: parsed.data.status }),
      ...(parsed.data.contactId && { contactId: parsed.data.contactId }),
      limit: parsed.data.limit,
    });
    return {
      total: result.totalCount,
      returned: result.items.length,
      vouchers: result.items.map((v) => ({
        id: v.id,
        code: v.code,
        offerName: v.offerName,
        contactName: v.contactFullName,
        status: v.status,
        issuedAt: v.issuedAt,
        expiresAt: v.expiresAt,
        redeemedAt: v.redeemedAt,
      })),
    };
  },
};

// ============================================================
// Emissione voucher
// ============================================================
const IssueSchema = z.object({
  offerId: z.string().uuid(),
  contactId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const issueVoucherTool: RobotTool = {
  name: "issueVoucher",
  description:
    "Emette un voucher per un contatto specifico associato a una offer esistente. Richiede offerId (l'offer deve essere attiva, stile '10% sconto') + contactId. Il codice voucher viene generato automaticamente. Confirm obbligatorio (azione commerciale).",
  input_schema: {
    type: "object",
    properties: {
      offerId: { type: "string", description: "UUID dell'offer (catalogo loyalty)" },
      contactId: { type: "string", description: "UUID del contatto destinatario" },
      notes: { type: "string", description: "Note interne (max 500 char)" },
    },
    required: ["offerId", "contactId"],
    additionalProperties: false,
  },
  requiredCapability: "voucher.issue",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = IssueSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    const result = await issueVoucherAction({
      offerId: parsed.data.offerId,
      contactId: parsed.data.contactId,
      ...(parsed.data.notes && { notes: parsed.data.notes }),
    });
    if (!result.ok) return { error: "emissione_fallita", message: result.error };
    return {
      ok: true,
      voucherId: result.voucherId,
      code: result.code,
      message: `Voucher emesso. Codice: ${result.code}`,
    };
  },
};
