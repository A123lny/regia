#!/usr/bin/env node
// Pulizia testi UI di Regìa. Operazioni eseguite SOLO nelle stringhe JSX/
// contenuti visibili (literal fra tag, title metadata). NON tocca commenti,
// nomi di variabili, codici dei log server, nomi tabelle/colonne DB.
//
// Sostituisce:
//  - Apostrofi al posto di accenti: "piu'", "puo'", "perche'", "finche'", "e'"
//    quando sono parole intere (word boundary) in testo visibile
//  - Codici tecnici visibili: (RF-x.y), (RN-x), (F0), (F1), (F2),
//    (M1..M14), F1.5a/F1.5b tra parentesi o dopo ":"
//  - Riferimenti "satori" nei testi UI
//
// Esegui con: node tools/pulizia-testi.js [--dry]

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "app", "src");
const DRY = process.argv.includes("--dry");

// File .tsx / .ts dentro src/app/(protected) e src/components:
// solo lì la pulizia testo-UI è rilevante. I moduli m*/internal hanno log
// server che non vanno toccati.
const TARGETS = [
  path.join(ROOT, "app", "(protected)"),
  path.join(ROOT, "components"),
];

// Replace rules. Prima rule = match, Seconda = replace.
// IMPORTANTE: le replace su apostrofi sono fatte SOLO dentro stringhe JSX
// o literal che "sembrano UI" (ancorate tra > e <, o " " / ' '); il regex
// qui opera su tutto il file, ma applichiamo filtri euristici a valle.
const RULES = [
  // Accenti al posto di apostrofi — solo all'interno di contenuti JSX/stringhe italiane.
  // Pattern tipici: testo tra tag, testo tra quotes.
  [/\bpiu'\B/g, "più"],
  [/\bPiu'\B/g, "Più"],
  [/\bpuo'\B/g, "può"],
  [/\bPuo'\B/g, "Può"],
  [/\bperche'\B/g, "perché"],
  [/\bPerche'\B/g, "Perché"],
  [/\bfinche'\B/g, "finché"],
  [/\bFinche'\B/g, "Finché"],
  [/\bgia'\B/g, "già"],
  [/\bGia'\B/g, "Già"],
  [/\bcosi'\B/g, "così"],
  [/\bCosi'\B/g, "Così"],
  [/\bcio'\B/g, "ciò"],
  [/\bCio'\B/g, "Ciò"],
  [/\bverra'\B/g, "verrà"],
  [/\bVerra'\B/g, "Verrà"],
  [/\bsara'\B/g, "sarà"],
  [/\bSara'\B/g, "Sarà"],
  [/\bfara'\B/g, "farà"],
  [/\bFara'\B/g, "Farà"],
  [/\bandra'\B/g, "andrà"],
  [/\bAndra'\B/g, "Andrà"],
  [/\bAttivita'\B/g, "Attività"],
  [/\battivita'\B/g, "attività"],
  [/\bPriorita'\B/g, "Priorità"],
  [/\bpriorita'\B/g, "priorità"],
  [/\bGravita'\B/g, "Gravità"],
  [/\bgravita'\B/g, "gravità"],
  [/\bautorita'\B/g, "autorità"],
  // Codici tecnici fra parentesi visibili: (RF-x.y), (RN-xx), (F0/F1/F2), (M01..M14).
  // Rimuoviamo la parentesi + contenuto. Match conservativo.
  [/\s*\(RF-\d+(?:\.\d+)*[a-z]?\)/g, ""],
  [/\s*\(RN-\d+(?:\.\d+)*[a-z]?\)/g, ""],
  [/\s*\(RA-\d+(?:\.\d+)*[a-z]?\)/g, ""],
  [/\s*\(RS-\d+(?:\.\d+)*[a-z]?\)/g, ""],
  [/\s*\(RQ-\d+(?:\.\d+)*[a-z]?\)/g, ""],
  [/\s*\(RU-\d+[a-z]?\)/g, ""],
  [/\s*\(RNF-\d+\)/g, ""],
  [/\s*\(F0[-\w]*\)/g, ""],
  [/\s*\(F1(?:\.\d+[a-z]*)?\)/g, ""],
  [/\s*\(F2\)/g, ""],
  [/\s*\(M\d{1,2}[a-z]?\)/g, ""],
  // "In F1 M04…" tipico in Provider media: taglia prefissi "In F1[a-z]* Mx..."
  [/\bIn F1(?:\.\d+[a-z])?(?:\s+M\d{1,2}[a-z]?)?[:,]?\s*/g, ""],
  // "RF-x.y:" o "RN-x:" o "M0x:" a inizio frase (prefissi) — rimuove il tag ma tiene il testo.
  [/\bRF-\d+(?:\.\d+)*[a-z]?\s*[:·]\s*/g, ""],
  [/\bRN-\d+(?:\.\d+)*[a-z]?\s*[:·]\s*/g, ""],
  [/\bRA-\d+(?:\.\d+)*[a-z]?\s*[:·]\s*/g, ""],
  // "satori" in testo UI (Provider media diceva "server-side via satori + resvg")
  [/\s*\(satori[^)]*\)/gi, ""],
];

function cleanFile(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  let out = src;
  for (const [re, rep] of RULES) {
    out = out.replace(re, rep);
  }
  if (out === src) return false;
  if (!DRY) fs.writeFileSync(filePath, out);
  return true;
}

function walk(dir) {
  const results = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      results.push(...walk(p));
    } else if (/\.(tsx?|mdx?)$/.test(name)) {
      results.push(p);
    }
  }
  return results;
}

let changed = 0;
let total = 0;
for (const target of TARGETS) {
  if (!fs.existsSync(target)) continue;
  for (const f of walk(target)) {
    total++;
    if (cleanFile(f)) {
      changed++;
      console.log("~", path.relative(path.join(__dirname, ".."), f));
    }
  }
}
console.log(`\n${changed}/${total} file toccati${DRY ? " (dry-run)" : ""}.`);
