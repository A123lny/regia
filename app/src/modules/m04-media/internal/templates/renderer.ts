// Renderer template: satori (JSX → SVG) + resvg (SVG → PNG).
// Blocking ~500-2000ms per template. Font cached in memoria dopo il primo call.
// Log step-by-step: in caso di fallimento in produzione, i log Vercel mostrano
// esattamente quale sub-step (fonts/satori/resvg) ha dato problema.

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
  const start = Date.now();

  let fonts;
  try {
    fonts = await loadFonts();
  } catch (err) {
    console.error("[renderer] loadFonts failed", {
      templateId,
      err: err instanceof Error ? err.message : String(err),
    });
    throw new Error(
      `Caricamento font fallito: ${err instanceof Error ? err.message : "sconosciuto"}`,
    );
  }
  console.log("[renderer] fonts ok", { templateId, ms: Date.now() - start });

  const jsx = renderTemplateJsx(templateId, input);

  // JSX → SVG
  let svg: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    svg = await satori(jsx as any, {
      width: dims.width,
      height: dims.height,
      fonts: fonts.map((f) => ({
        name: f.name,
        data: f.data,
        weight: f.weight as 400 | 700 | 800,
        style: f.style,
      })),
    });
  } catch (err) {
    console.error("[renderer] satori failed", {
      templateId,
      err: err instanceof Error ? err.message : String(err),
    });
    throw new Error(
      `Rendering satori (SVG) fallito: ${err instanceof Error ? err.message : "sconosciuto"}`,
    );
  }

  // SVG → PNG
  let pngBytes: Uint8Array;
  try {
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: dims.width },
      background: "rgba(255,255,255,0)",
    });
    const png = resvg.render();
    pngBytes = new Uint8Array(png.asPng());
  } catch (err) {
    console.error("[renderer] resvg failed", {
      templateId,
      err: err instanceof Error ? err.message : String(err),
    });
    throw new Error(
      `Conversione PNG (resvg) fallita: ${err instanceof Error ? err.message : "sconosciuto"}. Possibile: binary nativo @resvg/resvg-js non disponibile nel runtime.`,
    );
  }

  console.log("[renderer] ok", {
    templateId,
    bytes: pngBytes.byteLength,
    totalMs: Date.now() - start,
  });
  return { pngBytes, width: dims.width, height: dims.height };
}
