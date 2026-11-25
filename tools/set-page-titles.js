#!/usr/bin/env node
// Aggiunge `export const metadata = { title: "<Nome>" }` alle page.tsx che
// non ne hanno uno. Il layout root ha template "%s · Regìa", quindi è
// sufficiente esportare il titolo breve. Lo script NON tocca pagine che
// hanno già metadata.title.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "app", "src", "app", "(protected)");

// Mapping path → titolo. Chiavi relative a ROOT con separatori /.
// Non includiamo il suffisso "page.tsx" nella chiave.
const TITLES = {
  "anti-abbandono": "Da recuperare",
  "audit": "Registro attività",
  "catalogo": "Catalogo",
  "clienti": "Clienti",
  "contatti/duplicati": "Contatti duplicati",
  "contatti/[id]/dati-personali": "Dati personali",
  "contenuti/archivio": "Archivio contenuti",
  "contenuti/calendario": "Calendario editoriale",
  "contenuti/calendario/[date]": "Giorno nel calendario",
  "contenuti/sessione": "Sessione di approvazione",
  "contenuti/[slug]/calendario": "Calendario del marchio",
  "contenuti/[slug]": "Contenuti del marchio",
  "contenuti/[slug]/[draftId]": "Dettaglio contenuto",
  "fornitori": "Fornitori",
  "governance/advertising": "Advertising",
  "governance/capacita-rider": "Capacità rider",
  "governance": "Regole",
  "governance/zone-consegna": "Zone di consegna",
  "impostazioni/memoria-agente": "Memoria agente",
  "impostazioni/provider-media": "Provider media",
  "impostazioni/ricorrenze": "Ricorrenze",
  "iscrizioni": "Iscrizioni",
  "marchi": "Marchi",
  "marchi/[slug]": "Marchio",
  "marchi/[slug]/media": "Libreria media",
  "ordini": "Ordini",
  "recensioni": "Recensioni",
  "rete": "Rete",
  "ristoranti/mercato": "Mercato ristoranti",
  "ristoranti": "Rete ristoranti Lenny",
};

function pagePath(relKey) {
  return path.join(ROOT, relKey, "page.tsx");
}

function hasMetadataTitle(src) {
  // Rileva sia `export const metadata = { title: ... }` sia `metadata.title =` sia
  // `export const metadata: Metadata = { title: ... }`.
  return /export\s+const\s+metadata[^=]*=\s*\{[^}]*title/.test(src);
}

function injectMetadata(src, pageTitle) {
  // Se c'è già `import type { Metadata } from "next";` inseriamo subito dopo.
  // Altrimenti aggiungiamo import.
  const hasMetadataImport = /from\s+["']next["']/.test(src) && /\bMetadata\b/.test(src);
  const metaLine = `export const metadata: Metadata = { title: "${pageTitle}" };\n\n`;
  if (hasMetadataImport) {
    // Trova l'ultimo `import ... from "next";` o simili e inserisci dopo
    // il blocco import.
    const lines = src.split(/\r?\n/);
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\s/.test(lines[i])) lastImport = i;
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, "", metaLine.trimEnd());
      return lines.join("\n");
    }
  }
  // Aggiungi import Metadata + export const metadata all'inizio del file.
  return `import type { Metadata } from "next";\n\n${metaLine}${src}`;
}

let changed = 0;
const dry = process.argv.includes("--dry");
for (const [relKey, title] of Object.entries(TITLES)) {
  const p = pagePath(relKey);
  if (!fs.existsSync(p)) {
    console.warn(" skip (not found):", relKey);
    continue;
  }
  const src = fs.readFileSync(p, "utf8");
  if (hasMetadataTitle(src)) {
    continue;
  }
  const out = injectMetadata(src, title);
  if (!dry) fs.writeFileSync(p, out);
  changed++;
  console.log("~", relKey, "→", `"${title}"`);
}
console.log(`\n${changed} pagine aggiornate${dry ? " (dry-run)" : ""}.`);
