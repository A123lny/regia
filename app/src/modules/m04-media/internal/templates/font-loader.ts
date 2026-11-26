// Font loader per satori con fallback multi-CDN, timeout, log server.
// Problema su Vercel: cdn.jsdelivr occasionalmente timeout o blocco network
// → satori fallisce → "Errore interno nella generazione del template".
// Qui: timeout 8s per CDN, prova 2 fallback, log diagnostico.

type FontRecord = {
  name: string;
  data: ArrayBuffer;
  weight: number;
  style: "normal" | "italic";
};

let cachedFonts: FontRecord[] | null = null;

const FONT_TIMEOUT_MS = 8_000;

type FontSource = {
  name: string;
  weight: number;
  style: "normal" | "italic";
  urls: string[];
};

const FONTS: FontSource[] = [
  {
    name: "Inter",
    weight: 400,
    style: "normal",
    urls: [
      "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf",
      "https://unpkg.com/@fontsource/inter@latest/files/inter-latin-400-normal.woff",
    ],
  },
  {
    name: "Inter",
    weight: 700,
    style: "normal",
    urls: [
      "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf",
      "https://unpkg.com/@fontsource/inter@latest/files/inter-latin-700-normal.woff",
    ],
  },
  {
    name: "Bricolage",
    weight: 800,
    style: "normal",
    urls: [
      "https://cdn.jsdelivr.net/fontsource/fonts/bricolage-grotesque@latest/latin-800-normal.ttf",
      "https://unpkg.com/@fontsource/bricolage-grotesque@latest/files/bricolage-grotesque-latin-800-normal.woff",
    ],
  },
];

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FONT_TIMEOUT_MS),
    cache: "force-cache",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.arrayBuffer();
}

async function fetchFontWithFallback(src: FontSource): Promise<ArrayBuffer> {
  let lastErr: unknown = null;
  for (const url of src.urls) {
    try {
      return await fetchFont(url);
    } catch (err) {
      lastErr = err;
      console.warn("[font-loader] fetch failed, try next", {
        font: `${src.name}:${src.weight}`,
        url,
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }
  throw new Error(
    `Impossibile scaricare font ${src.name} ${src.weight}: ${
      lastErr instanceof Error ? lastErr.message : "nessun CDN disponibile"
    }`,
  );
}

export async function loadFonts(): Promise<FontRecord[]> {
  if (cachedFonts) return cachedFonts;
  const start = Date.now();
  const loaded = await Promise.all(
    FONTS.map(async (src) => {
      const data = await fetchFontWithFallback(src);
      return { name: src.name, data, weight: src.weight, style: src.style };
    }),
  );
  cachedFonts = loaded;
  console.log("[font-loader] fonts caricati", {
    count: loaded.length,
    ms: Date.now() - start,
  });
  return cachedFonts;
}
