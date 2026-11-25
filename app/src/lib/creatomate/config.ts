// Configurazione Creatomate. Importabile sia server che client:
// non esporta la chiave API (stay in process.env server-side).

export const CREATOMATE_API_BASE = "https://api.creatomate.com/v2";

// Nome env var che contiene la chiave Bearer.
export const CREATOMATE_API_KEY_ENV = "CREATOMATE_API_KEY";

// Stima costo per render in USD. Creatomate addebita in crediti (50 free nel
// piano trial), ma il nostro tracker spesa è in USD. 1 credito ≈ $0.10
// (prezzo listino piano Entry ~$49 / 500 crediti ≈ $0.098, arrotondato).
// Un render breve consuma 1 credito; render video più lunghi anche 3-5.
export const CREATOMATE_USD_PER_CREDIT = 0.1;

// Preset "render di test": dimensioni ridotte + durata breve per ridurre il
// consumo crediti durante lo sviluppo. Vengono forzati nei modifications
// dove supportato dal template.
export type CreatomateRenderQuality = "test" | "final";

export type CreatomateRenderPreset = {
  width?: number;
  height?: number;
  frameRate?: number;
  // Stima crediti consumati — serve al preflight budget.
  estimatedCredits: number;
};

export const CREATOMATE_PRESETS: Record<CreatomateRenderQuality, CreatomateRenderPreset> = {
  test: { width: 480, height: 480, frameRate: 24, estimatedCredits: 1 },
  final: { estimatedCredits: 3 },
};

// Slug del provider in media_providers che deve essere attivo con uso
// commerciale per permettere la generazione Creatomate (parità con fal).
export const CREATOMATE_PROVIDER_SLUG = "creatomate";

// Check se la chiave è presente nell'environment. Vive qui (non in client.ts)
// perché deve essere importabile dal barrel public.ts senza trascinare
// `import "server-only"` di client.ts nel bundle client. A runtime server,
// process.env["CREATOMATE_API_KEY"] è letta normalmente; nel bundle client
// non è esposta (nessun NEXT_PUBLIC_ prefix) quindi ritornerebbe false,
// ma la funzione non è chiamata da client components.
export function isCreatomateKeyPresent(): boolean {
  const k = process.env["CREATOMATE_API_KEY"];
  return !!k && k.trim().length > 0;
}
