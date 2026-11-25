#!/usr/bin/env node
// Pulizia codici RF-/RN-/Mxx/F0/F1/F2 dal contenuto UI esposto agli utenti
// via HelpButton (help-content.ts). Il file ha molti riferimenti in stringhe
// multi-line, lo script normale non li cattura perché i codici sono dentro i
// testi letterali, non fra parentesi. Qui facciamo match più aggressivo:
// rimuoviamo "RF-x.y", "(RF-x.y)", "RF-x.y..RF-x.y", "§8.2", "M01..M15"
// quando non sono prefissi di nome variabile.

const fs = require("node:fs");
const path = require("node:path");

const TARGET = path.join(
  __dirname,
  "..",
  "app",
  "src",
  "components",
  "help",
  "help-content.ts",
);

const RULES = [
  // Range tipo "RF-6.1..6.10" o "RF-6.15..6.20"
  [/\bRF-\d+(?:\.\d+)+\.\.\d+(?:\.\d+)*/g, ""],
  [/\(RF-\d+(?:\.\d+)*[a-z]?,?\s*(?:RF-\d+(?:\.\d+)*[a-z]?,?\s*)*\)/g, ""],
  [/\(RN-\d+(?:\.\d+)*[a-z]?,?\s*(?:RN-\d+(?:\.\d+)*[a-z]?,?\s*)*\)/g, ""],
  [/\(RA-\d+(?:\.\d+)*[a-z]?\)/g, ""],
  [/\s+\bRF-\d+(?:\.\d+)*[a-z]?\b/g, ""],
  [/\s+\bRN-\d+(?:\.\d+)*[a-z]?\b/g, ""],
  [/\s+\bRA-\d+(?:\.\d+)*[a-z]?\b/g, ""],
  [/\s+\bRS-\d+(?:\.\d+)*[a-z]?\b/g, ""],
  // Prefissi §x.y (riferimenti al capitolato) sempre interni
  [/\s*§\s*\d+(?:\.\d+)*/g, ""],
  // Moduli "M01..M15" come riferimento (ma lascia stand-alone solo se spazio
  // davanti — non rompiamo URL o nomi React come "M3Component")
  [/\s+\bM(?:0[1-9]|1[0-5])\b/g, ""],
  // F0, F1, F1.5a, F2, F0-b (fasi di sviluppo interne)
  [/\s*\bF0(?:-[a-z0-9]+)?\b/g, ""],
  [/\s*\bF1(?:\.\d+[a-z]*)?\b/g, ""],
  [/\s*\bF2\b/g, ""],
  // Normalizza spazi doppi lasciati dalle rimozioni
  [/ {2,}/g, " "],
  [/ +\./g, "."],
  [/ +,/g, ","],
];

const src = fs.readFileSync(TARGET, "utf8");
let out = src;
for (const [re, rep] of RULES) {
  out = out.replace(re, rep);
}
if (out !== src) {
  fs.writeFileSync(TARGET, out);
  console.log("~ help-content.ts aggiornato.");
} else {
  console.log("Nessuna modifica necessaria.");
}
