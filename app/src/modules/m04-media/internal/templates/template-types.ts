// M04 — Types per template grafici di marca (RF-4.2).

export type TemplateFormat = "square" | "portrait" | "story";

export const FORMAT_DIMENSIONS: Record<TemplateFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
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
