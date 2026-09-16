// M03 — Caricamento template prompt versionati (§9.2 capitolato).
// Legge i file .md una sola volta e cache-a a livello modulo per ridurre
// I/O nel hot path. Placeholder interpolati come {{key}}.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const cache = new Map<string, string>();

export function loadPromptTemplate(name: "social-post"): string {
  const cached = cache.get(name);
  if (cached) return cached;

  const path = join(process.cwd(), "src/modules/m03-editorial/internal/prompts", `${name}.md`);
  const content = readFileSync(path, "utf-8");
  cache.set(name, content);
  return content;
}

// Sostituisce {{key}} con values[key]. Se key non trovata, sostituisce con "".
// Nessun escape sui valori: il chiamante è responsabile del delimitatore
// (marker XML per input non fidato, RA-8.7).
export function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");
}
