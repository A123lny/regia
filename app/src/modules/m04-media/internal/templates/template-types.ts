// M04 — Types per template grafici di marca (RF-4.2).

export type TemplateFormat =
  | "square"
  | "portrait"
  | "story"
  | "a4-portrait" // RF-4.7 locandina stampabile A4 verticale (300dpi)
  | "a4-landscape"; // RF-4.7 locandina stampabile A4 orizzontale (300dpi)

// 300 DPI = res standard offset stampa.
// A4 fisico 210x297mm -> 2480x3508 px a 300dpi.
export const FORMAT_DIMENSIONS: Record<TemplateFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  "a4-portrait": { width: 2480, height: 3508 },
  "a4-landscape": { width: 3508, height: 2480 },
};

// Flag "destinato alla stampa" per la UI: anteprima dedicata + nota su
// dimensione file / tempi di render diversi dai social.
export const PRINT_FORMATS: ReadonlySet<TemplateFormat> = new Set<TemplateFormat>([
  "a4-portrait",
  "a4-landscape",
]);

export const FORMAT_LABELS: Record<TemplateFormat, string> = {
  square: "Quadrato (IG post 1080x1080)",
  portrait: "Verticale (IG post 1080x1350)",
  story: "Story (1080x1920)",
  "a4-portrait": "Stampa A4 verticale (300dpi)",
  "a4-landscape": "Stampa A4 orizzontale (300dpi)",
};

export type TemplateFieldDef = {
  key: string;
  label: string;
  placeholder?: string;
  required: boolean;
  maxLength?: number;
  multiline?: boolean;
};

export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  brandSlugs: string[]; // ["lenny"], ["stazione"], oppure [] = disponibile a tutti i brand
  format: TemplateFormat;
  fields: TemplateFieldDef[];
};

export type TemplateRenderInput = {
  brandDisplayName: string;
  brandColor: string;
  brandLogoUrl: string | null;
  fields: Record<string, string>;
};
