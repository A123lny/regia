// M04 — Font loader per satori.
// satori richiede font come ArrayBuffer. Carichiamo Bricolage Grotesque + Inter
// da Google Fonts al primo utilizzo, poi cache in memoria.

let cachedFonts:
  { name: string; data: ArrayBuffer; weight: number; style: "normal" | "italic" }[] | null = null;

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status} ${res.statusText}`);
  return await res.arrayBuffer();
}

export async function loadFonts(): Promise<
  { name: string; data: ArrayBuffer; weight: number; style: "normal" | "italic" }[]
> {
  if (cachedFonts) return cachedFonts;

  // Google Fonts CSS API pattern: prendi il woff/ttf diretto dai commenti CSS.
  // Per semplicita usiamo url font-static ttf noti (Inter e Bricolage Grotesque).
  // In produzione considera un CDN dedicato per stability.
  const [interRegular, interBold, bricolageBold] = await Promise.all([
    fetchFont("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf"),
    fetchFont("https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf"),
    fetchFont(
      "https://cdn.jsdelivr.net/fontsource/fonts/bricolage-grotesque@latest/latin-800-normal.ttf",
    ),
  ]);

  cachedFonts = [
    { name: "Inter", data: interRegular, weight: 400, style: "normal" },
    { name: "Inter", data: interBold, weight: 700, style: "normal" },
    { name: "Bricolage", data: bricolageBold, weight: 800, style: "normal" },
  ];
  return cachedFonts;
}
