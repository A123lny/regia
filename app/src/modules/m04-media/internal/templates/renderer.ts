// M04 — Renderer template: satori (JSX → SVG) + resvg (SVG → PNG).
// Blocking ~500-2000ms per template. Font cached in memoria dopo il primo call.

import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadFonts } from "./font-loader";
import { renderTemplateJsx, getTemplateDefinition } from "./template-registry";
import { FORMAT_DIMENSIONS, type TemplateRenderInput } from "./template-types";

export async function renderTemplateToPng(
  templateId: string,
  input: TemplateRenderInput,
): Promise<{ pngBytes: Uint8Array; width: number; height: number }> {
  const def = getTemplateDefinition(templateId);
  if (!def) throw new Error(`Template "${templateId}" non trovato`);

  const dims = FORMAT_DIMENSIONS[def.format];
  const fonts = await loadFonts();
  const jsx = renderTemplateJsx(templateId, input);

  // JSX → SVG
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svg = await satori(jsx as any, {
    width: dims.width,
    height: dims.height,
    fonts: fonts.map((f) => ({
      name: f.name,
      data: f.data,
      weight: f.weight as 400 | 700 | 800,
      style: f.style,
    })),
  });

  // SVG → PNG
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: dims.width },
    background: "rgba(255,255,255,0)",
  });
  const png = resvg.render();
  const pngBytes = new Uint8Array(png.asPng());

  return { pngBytes, width: dims.width, height: dims.height };
}
