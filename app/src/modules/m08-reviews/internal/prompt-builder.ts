// RA-8.6 + RA-8.7: vincoli hard applicati dal codice, input delimitato.
// La bozza viene generata dall'adapter Anthropic esistente di M03.

import type { Review } from "./types";

export type BrandContext = {
  slug: string;
  name: string;
  toneOfVoice: string | null;
  pillars: string[];
};

export function buildReplyPrompt(
  review: Review,
  brand: BrandContext,
): { system: string; user: string } {
  const toneLines: string[] = [];
  if (brand.toneOfVoice) toneLines.push(`Tono di voce: ${brand.toneOfVoice}`);
  if (brand.pillars.length) toneLines.push(`Pilastri del marchio: ${brand.pillars.join("; ")}`);
  const toneBlock = toneLines.join("\n");

  const specificRules: string[] = [
    "La risposta deve essere in italiano.",
    "Lunghezza massima: 500 caratteri (vincolo hard).",
    "Mai promettere sconti, rimborsi o compensazioni specifiche (§8.2).",
    "Mai citare prezzi, orari o dati concreti che non sono dati certi.",
  ];
  if (brand.slug === "lenny") {
    specificRules.push(
      "RF-8.7: la risposta pubblica NON scarica mai la colpa sul ristorante partner. La questione va risolta privatamente con il locale, non in pubblico.",
    );
  }
  if (review.classification === "negative") {
    specificRules.push(
      "Tono empatico. Riconosci il disagio. Chiedi dettagli in privato (email/DM) per capire e migliorare.",
    );
  } else if (review.classification === "positive") {
    specificRules.push("Tono breve e caloroso. Massimo 2-3 frasi. Ringrazia specificamente.");
  }

  const system = `Sei il titolare che risponde pubblicamente a una recensione per il marchio "${brand.name}".

${toneBlock}

Regole da rispettare SEMPRE (vincolate dal codice, non negoziabili):
${specificRules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Rispondi con la sola bozza di risposta, senza preamboli né virgolette.`;

  const user = `Recensione ricevuta (${review.rating} stelle, autore ${review.authorName ?? "anonimo"}):

<customer_review>
${review.textOriginal ?? "(nessun testo)"}
</customer_review>

Prepara la bozza di risposta pubblica.`;

  return { system, user };
}
