// RN-robot: gestione brand M02 (create, update, archive, restore).
// listBrands e' gia' esposto da list-brands.ts.

import { z } from "zod";
import { createBrand, updateBrand, archiveBrand, restoreBrand } from "@/modules/m02-brand/public";
import type { RobotTool } from "./tool-types";

// ============================================================
// Create brand
// ============================================================
const CreateSchema = z.object({
  displayName: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "slug: solo lowercase, numeri e trattini"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "color: formato hex #RRGGBB"),
});

export const createBrandTool: RobotTool = {
  name: "createBrand",
  description:
    "Crea un nuovo marchio (brand) nell'organizzazione. Richiede displayName (es. 'Pizzeria da Mario'), slug (url-safe, es. 'pizzeria-mario') e color (hex, es. '#c25a3b'). Confirm obbligatorio.",
  input_schema: {
    type: "object",
    properties: {
      displayName: { type: "string", description: "Nome visualizzato (1-100 char)" },
      slug: {
        type: "string",
        description: "Slug url-safe (lowercase+numeri+trattini, 2-40 char, es. 'eni-cafe')",
      },
      color: {
        type: "string",
        description: "Colore brand hex #RRGGBB (es. '#c25a3b')",
      },
    },
    required: ["displayName", "slug", "color"],
    additionalProperties: false,
  },
  requiredCapability: "brand.crud",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = CreateSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    try {
      const brand = await createBrand(parsed.data);
      return {
        ok: true,
        brandId: brand.id,
        slug: brand.slug,
        message: `Brand "${brand.displayName}" creato (slug: ${brand.slug}).`,
      };
    } catch (err) {
      return { error: "creazione_fallita", message: err instanceof Error ? err.message : "?" };
    }
  },
};

// ============================================================
// Update brand
// ============================================================
const UpdateSchema = z.object({
  brandId: z.string().uuid(),
  patch: z.object({
    displayName: z.string().min(1).max(100).optional(),
    slug: z
      .string()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    emailFromAddress: z.string().email().nullable().optional(),
    emailFromDisplayName: z.string().max(100).nullable().optional(),
    emailReplyTo: z.string().email().nullable().optional(),
    googlePlaceId: z.string().max(200).nullable().optional(),
  }),
});

export const updateBrandTool: RobotTool = {
  name: "updateBrand",
  description:
    "Aggiorna i campi base di un marchio. Patch con i campi da cambiare (ometti quelli invariati). Per email/googlePlaceId passa null per svuotare. Non modifica tono/pillar/consensi (per quelli ci sono tool dedicati o la UI del brand kit).",
  input_schema: {
    type: "object",
    properties: {
      brandId: { type: "string", description: "UUID del brand" },
      patch: {
        type: "object",
        properties: {
          displayName: { type: "string" },
          slug: { type: "string" },
          color: { type: "string" },
          emailFromAddress: { type: ["string", "null"] },
          emailFromDisplayName: { type: ["string", "null"] },
          emailReplyTo: { type: ["string", "null"] },
          googlePlaceId: { type: ["string", "null"] },
        },
        additionalProperties: false,
      },
    },
    required: ["brandId", "patch"],
    additionalProperties: false,
  },
  requiredCapability: "brand.crud",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = UpdateSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    try {
      const p = parsed.data.patch;
      const brand = await updateBrand(parsed.data.brandId, {
        ...(p.displayName !== undefined && { displayName: p.displayName }),
        ...(p.slug !== undefined && { slug: p.slug }),
        ...(p.color !== undefined && { color: p.color }),
        ...(p.emailFromAddress !== undefined && { emailFromAddress: p.emailFromAddress }),
        ...(p.emailFromDisplayName !== undefined && {
          emailFromDisplayName: p.emailFromDisplayName,
        }),
        ...(p.emailReplyTo !== undefined && { emailReplyTo: p.emailReplyTo }),
        ...(p.googlePlaceId !== undefined && { googlePlaceId: p.googlePlaceId }),
      });
      return { ok: true, brandId: brand.id, message: `Brand "${brand.displayName}" aggiornato.` };
    } catch (err) {
      return { error: "aggiornamento_fallito", message: err instanceof Error ? err.message : "?" };
    }
  },
};

// ============================================================
// Archive brand
// ============================================================
const BrandIdSchema = z.object({ brandId: z.string().uuid() });

export const archiveBrandTool: RobotTool = {
  name: "archiveBrand",
  description:
    "Archivia un marchio (soft delete). Il brand non appare più nelle liste attive ma i contatti/contenuti collegati restano. Reversibile con restoreBrand. Confirm obbligatorio.",
  input_schema: {
    type: "object",
    properties: { brandId: { type: "string", description: "UUID del brand" } },
    required: ["brandId"],
    additionalProperties: false,
  },
  requiredCapability: "brand.crud",
  kind: "destructive",
  execute: async (rawInput) => {
    const parsed = BrandIdSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    try {
      const brand = await archiveBrand(parsed.data.brandId);
      return { ok: true, brandId: brand.id, message: `Brand "${brand.displayName}" archiviato.` };
    } catch (err) {
      return { error: "archiviazione_fallita", message: err instanceof Error ? err.message : "?" };
    }
  },
};

// ============================================================
// Restore brand
// ============================================================
export const restoreBrandTool: RobotTool = {
  name: "restoreBrand",
  description:
    "Ripristina un marchio precedentemente archiviato. Torna attivo nelle liste.",
  input_schema: {
    type: "object",
    properties: { brandId: { type: "string", description: "UUID del brand" } },
    required: ["brandId"],
    additionalProperties: false,
  },
  requiredCapability: "brand.crud",
  kind: "write",
  execute: async (rawInput) => {
    const parsed = BrandIdSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { error: "input_invalido", details: parsed.error.message };
    try {
      const brand = await restoreBrand(parsed.data.brandId);
      return { ok: true, brandId: brand.id, message: `Brand "${brand.displayName}" ripristinato.` };
    } catch (err) {
      return { error: "ripristino_fallito", message: err instanceof Error ? err.message : "?" };
    }
  },
};
