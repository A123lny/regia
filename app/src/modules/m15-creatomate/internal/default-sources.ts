// Default Creatomate sources (RenderScript JSON) usabili SENZA template
// pre-registrato nel pannello Creatomate. Permettono "Crea visual" di
// funzionare subito dopo l'attivazione dell'account.
//
// Ogni default è un oggetto source compatibile con l'API POST /v2/renders:
//   { output_format, width, height, duration?, elements: [...] }
//
// Doc: https://creatomate.com/docs/json/introduction

export type DefaultVariant = "square_post" | "story_reel" | "poster_a4";

export const DEFAULT_VARIANT_LABELS: Record<DefaultVariant, string> = {
  square_post: "Post quadrato 1080×1080",
  story_reel: "Story / Reel 1080×1920 (video 8s)",
  poster_a4: "Locandina A4",
};

export type DefaultBrandContext = {
  displayName: string;
  color: string; // hex
  logoUrl: string | null;
};

export type DefaultDraftContext = {
  shortTitle: string; // es. prima frase bozza
  body: string; // testo completo bozza
  ctaText?: string; // es. "Prenota ora"
};

function textEl(opts: {
  name: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontWeight?: 400 | 700 | 800;
  color?: string;
  horizontalAlign?: "left" | "center" | "right";
}) {
  return {
    name: opts.name,
    type: "text",
    track: 1,
    x: `${opts.x}%`,
    y: `${opts.y}%`,
    width: `${opts.width}%`,
    height: `${opts.height}%`,
    x_alignment: "0%",
    y_alignment: "0%",
    fill_color: opts.color ?? "#ffffff",
    font_family: "Inter",
    font_weight: String(opts.fontWeight ?? 700),
    font_size: `${opts.fontSize}px`,
    line_height: "120%",
    text_wrap: true,
    horizontal_alignment: opts.horizontalAlign ?? "left",
    text: opts.text,
  };
}

function rectEl(opts: { name: string; color: string; x: number; y: number; w: number; h: number }) {
  return {
    name: opts.name,
    type: "shape",
    track: 0,
    x: `${opts.x}%`,
    y: `${opts.y}%`,
    width: `${opts.w}%`,
    height: `${opts.h}%`,
    fill_color: opts.color,
    path: "M 0 0 L 100 0 L 100 100 L 0 100 Z",
  };
}

function imageEl(opts: { name: string; url: string; x: number; y: number; w: number; h: number; fit?: "contain" | "cover" }) {
  return {
    name: opts.name,
    type: "image",
    track: 0,
    x: `${opts.x}%`,
    y: `${opts.y}%`,
    width: `${opts.w}%`,
    height: `${opts.h}%`,
    fit: opts.fit ?? "cover",
    source: opts.url,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Default 1 — Post quadrato 1080×1080 (immagine)
// Fondo brand color, titolo grande su banda bianca, logo in alto a destra.
// ────────────────────────────────────────────────────────────────────────

export function squarePostSource(
  brand: DefaultBrandContext,
  draft: DefaultDraftContext,
): Record<string, unknown> {
  const elements: Array<Record<string, unknown>> = [
    rectEl({ name: "bg", color: brand.color, x: 0, y: 0, w: 100, h: 100 }),
    rectEl({ name: "panel", color: "#ffffff", x: 7, y: 20, w: 86, h: 60 }),
    textEl({
      name: "title",
      text: draft.shortTitle || brand.displayName,
      x: 10,
      y: 25,
      width: 80,
      height: 35,
      fontSize: 72,
      fontWeight: 800,
      color: brand.color,
      horizontalAlign: "left",
    }),
    textEl({
      name: "body",
      text: draft.body || "",
      x: 10,
      y: 55,
      width: 80,
      height: 20,
      fontSize: 32,
      fontWeight: 400,
      color: "#333333",
    }),
    textEl({
      name: "brandname",
      text: brand.displayName,
      x: 7,
      y: 88,
      width: 86,
      height: 6,
      fontSize: 28,
      fontWeight: 700,
      color: "#ffffff",
      horizontalAlign: "left",
    }),
  ];
  if (brand.logoUrl) {
    elements.push(
      imageEl({ name: "logo", url: brand.logoUrl, x: 76, y: 5, w: 17, h: 10, fit: "contain" }),
    );
  }
  return {
    output_format: "jpg",
    width: 1080,
    height: 1080,
    elements,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Default 2 — Story/Reel 1080×1920 video 8s
// Fondo sfumato, titolo zoom-in, call-to-action in basso.
// ────────────────────────────────────────────────────────────────────────

export function storyReelSource(
  brand: DefaultBrandContext,
  draft: DefaultDraftContext,
): Record<string, unknown> {
  const elements: Array<Record<string, unknown>> = [
    rectEl({ name: "bg", color: brand.color, x: 0, y: 0, w: 100, h: 100 }),
    {
      ...textEl({
        name: "title",
        text: draft.shortTitle || brand.displayName,
        x: 8,
        y: 30,
        width: 84,
        height: 30,
        fontSize: 96,
        fontWeight: 800,
        color: "#ffffff",
        horizontalAlign: "center",
      }),
      animations: [{ type: "scale", scope: "element", duration: 1.5, easing: "cubic-out" }],
    },
    textEl({
      name: "body",
      text: draft.body || "",
      x: 10,
      y: 62,
      width: 80,
      height: 18,
      fontSize: 42,
      fontWeight: 400,
      color: "#ffffff",
      horizontalAlign: "center",
    }),
    {
      ...rectEl({ name: "cta_bg", color: "#ffffff", x: 25, y: 83, w: 50, h: 7 }),
    },
    textEl({
      name: "cta",
      text: draft.ctaText || "Scopri di più",
      x: 25,
      y: 83,
      width: 50,
      height: 7,
      fontSize: 42,
      fontWeight: 700,
      color: brand.color,
      horizontalAlign: "center",
    }),
  ];
  if (brand.logoUrl) {
    elements.push(
      imageEl({ name: "logo", url: brand.logoUrl, x: 40, y: 5, w: 20, h: 10, fit: "contain" }),
    );
  }
  return {
    output_format: "mp4",
    width: 1080,
    height: 1920,
    duration: 8,
    frame_rate: 25,
    elements,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Default 3 — Locandina A4 2480×3508 @ 300dpi
// Titolo grande, blocco testo centrale, brand name in basso.
// ────────────────────────────────────────────────────────────────────────

export function posterA4Source(
  brand: DefaultBrandContext,
  draft: DefaultDraftContext,
): Record<string, unknown> {
  const elements: Array<Record<string, unknown>> = [
    rectEl({ name: "bg", color: "#f8f5f0", x: 0, y: 0, w: 100, h: 100 }),
    rectEl({ name: "top_band", color: brand.color, x: 0, y: 0, w: 100, h: 18 }),
    textEl({
      name: "brandname",
      text: brand.displayName,
      x: 8,
      y: 7,
      width: 84,
      height: 7,
      fontSize: 140,
      fontWeight: 800,
      color: "#ffffff",
      horizontalAlign: "center",
    }),
    textEl({
      name: "title",
      text: draft.shortTitle || "Novità",
      x: 10,
      y: 30,
      width: 80,
      height: 20,
      fontSize: 180,
      fontWeight: 800,
      color: brand.color,
      horizontalAlign: "center",
    }),
    textEl({
      name: "body",
      text: draft.body || "",
      x: 10,
      y: 52,
      width: 80,
      height: 35,
      fontSize: 80,
      fontWeight: 400,
      color: "#333333",
      horizontalAlign: "center",
    }),
    textEl({
      name: "cta",
      text: draft.ctaText || brand.displayName,
      x: 10,
      y: 90,
      width: 80,
      height: 7,
      fontSize: 100,
      fontWeight: 700,
      color: brand.color,
      horizontalAlign: "center",
    }),
  ];
  return {
    output_format: "jpg",
    width: 2480,
    height: 3508,
    elements,
  };
}

export function sourceForVariant(
  variant: DefaultVariant,
  brand: DefaultBrandContext,
  draft: DefaultDraftContext,
): Record<string, unknown> {
  if (variant === "square_post") return squarePostSource(brand, draft);
  if (variant === "story_reel") return storyReelSource(brand, draft);
  return posterA4Source(brand, draft);
}
