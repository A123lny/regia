// M15 — logica di precompilazione modifications Creatomate da una bozza.
// Al primo giro il form è generico chiave→valore. Qui offriamo DUE utility
// pure usate dal pannello client:
//  - splitDraftText: estrae un titolo breve + testo lungo dalla bozza,
//    senza spezzare a metà parola (regola generale);
//  - guessModificationKind: classifica un chiave del modification (es.
//    "Titolo", "Headline", "Body", "Image.source") come "short"/"long"/"image"
//    in base al nome, così il pannello popola i campi corti con il titolo e
//    i campi descrizione con il testo lungo.

export type ModKind = "short" | "long" | "image" | "other";

export function splitDraftText(generatedText: string, themeInput: string): {
  shortTitle: string;
  longBody: string;
} {
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  const text = clean(generatedText || themeInput);

  // "Short title" = prima frase significativa, troncata a 60 char su confine
  // parola. "Long body" = testo completo (ridotto a 500 char se serve).
  const firstStop = text.search(/[.!?]\s/);
  const firstSentence = firstStop > 0 ? text.slice(0, firstStop + 1) : text;
  const shortTitle = truncateAtWord(firstSentence, 60);
  const longBody = truncateAtWord(text, 500);
  return { shortTitle, longBody };
}

export function truncateAtWord(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  const slice = s.slice(0, maxLen);
  const lastSpace = slice.lastIndexOf(" ");
  // Non troncare a metà parola: taglio all'ultimo spazio e aggiungo ellissi.
  return (lastSpace > maxLen * 0.5 ? slice.slice(0, lastSpace) : slice).trimEnd() + "…";
}

export function guessModificationKind(key: string): ModKind {
  const k = key.toLowerCase();
  if (
    k.includes("image") ||
    k.includes("photo") ||
    k.includes("background") ||
    k.endsWith(".source") ||
    k.endsWith(".src")
  ) {
    return "image";
  }
  if (
    k.includes("title") ||
    k.includes("headline") ||
    k.includes("heading") ||
    k.includes("name") ||
    k.includes("cta") ||
    k === "cta_text"
  ) {
    return "short";
  }
  if (
    k.includes("body") ||
    k.includes("description") ||
    k.includes("subtitle") ||
    k.includes("caption") ||
    k.includes("content") ||
    k.includes("paragraph")
  ) {
    return "long";
  }
  return "other";
}

export function prefillModifications(
  keys: string[],
  input: { themeInput: string; generatedText: string },
): Record<string, string> {
  const { shortTitle, longBody } = splitDraftText(input.generatedText, input.themeInput);
  const out: Record<string, string> = {};
  for (const k of keys) {
    const kind = guessModificationKind(k);
    if (kind === "short") out[k] = shortTitle;
    else if (kind === "long") out[k] = longBody;
    // image/other lasciati vuoti: il form li mostra, utente li decide.
  }
  return out;
}
