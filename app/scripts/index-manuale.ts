// RN-robot RAG: indicizza docs/manuale-piattaforma.md in manuale_chunks.
// Splitta per sottosezione (### heading), genera embeddings Gemini
// text-embedding-004 (768d), upsert in Supabase.
//
// Uso:
//   cd app && npm run index:manuale          (contro Supabase di .env.staging)
//
// Operazione IDEMPOTENTE: cancella e re-indicizza ad ogni run. Lanciare dopo
// ogni modifica significativa al manuale.

import * as fs from "node:fs";
import * as path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { embedContent } from "../src/lib/ai/gemini";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_KEY = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[index-manuale] mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const MANUALE_PATH = path.resolve(__dirname, "..", "..", "docs", "manuale-piattaforma.md");

type Chunk = { section: string; heading: string; content: string };

/**
 * Splitta il manuale in chunk basati sui ### heading.
 * Il testo tra `## N. Sezione` e il primo `###` viene incluso come chunk
 * con heading = la sezione principale.
 */
function splitManuale(raw: string): Chunk[] {
  const lines = raw.split("\n");
  const chunks: Chunk[] = [];
  let currentSection = "Intro";
  let currentHeading = "Intro";
  let buffer: string[] = [];

  function flush() {
    const text = buffer.join("\n").trim();
    if (text.length === 0) return;
    chunks.push({
      section: currentSection,
      heading: currentHeading,
      content: `# ${currentSection}\n## ${currentHeading}\n${text}`,
    });
    buffer = [];
  }

  for (const line of lines) {
    if (line.startsWith("## ") && !line.startsWith("### ")) {
      flush();
      currentSection = line.replace(/^##\s+/, "").trim();
      currentHeading = currentSection;
    } else if (line.startsWith("### ")) {
      flush();
      currentHeading = line.replace(/^###\s+/, "").trim();
    } else {
      buffer.push(line);
    }
  }
  flush();

  // Scarta chunk molto corti (< 40 char) — sono headings vuoti
  return chunks.filter((c) => c.content.trim().length >= 40);
}

async function main() {
  console.log("[index-manuale] leggo", MANUALE_PATH);
  const raw = fs.readFileSync(MANUALE_PATH, "utf-8");
  const chunks = splitManuale(raw);
  console.log(`[index-manuale] ${chunks.length} chunk estratti`);

  console.log("[index-manuale] richiedo embeddings Gemini (text-embedding-004, 768d)...");
  const embeddings = await embedContent(chunks.map((c) => c.content));
  console.log(`[index-manuale] ${embeddings.length} embeddings ricevuti`);

  console.log("[index-manuale] svuoto manuale_chunks e inserisco i nuovi...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;
  await adminAny.from("manuale_chunks").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const rows = chunks.map((c, i) => ({
    section: c.section,
    heading: c.heading,
    content: c.content,
    embedding: embeddings[i],
    source_file: "manuale-piattaforma.md",
  }));

  // Supabase richiede embedding come stringa o array; array funziona via SDK.
  const { error } = await adminAny.from("manuale_chunks").insert(rows);
  if (error) {
    console.error("[index-manuale] insert failed:", error.message);
    process.exit(1);
  }

  console.log(`[index-manuale] ✓ inseriti ${rows.length} chunk`);
}

main().catch((err) => {
  console.error("[index-manuale] fatal:", err);
  process.exit(1);
});
