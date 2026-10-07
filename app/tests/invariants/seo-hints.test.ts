// RF-13.7 analyzer SEO heuristico — unit test puro (no DB).
//
// Copre 6 check: lunghezza / titolo / CTA / numeri concreti / densita parole /
// frasi lunghe. L'analyzer e' deterministico: stesso input -> stesso output.

import { describe, expect, it } from "vitest";
import { analyzeSeoHints, countBySeverity } from "@/modules/m03-editorial/internal/seo-hints";

describe("RF-13.7 · analyzeSeoHints", () => {
  it("testo vuoto -> array vuoto (no hint)", () => {
    expect(analyzeSeoHints("")).toEqual([]);
    expect(analyzeSeoHints("   \n\n  ")).toEqual([]);
  });

  describe("lunghezza testo", () => {
    it("sotto 50 caratteri -> warning length-too-short", () => {
      const hints = analyzeSeoHints("Ciao");
      const h = hints.find((x) => x.key === "length-too-short");
      expect(h).toBeDefined();
      expect(h?.severity).toBe("warning");
    });

    it("oltre 2000 caratteri -> warning length-too-long", () => {
      const text = "promo valida fino al 15 novembre. ".repeat(80); // ~2720 char
      const hints = analyzeSeoHints(text);
      const h = hints.find((x) => x.key === "length-too-long");
      expect(h).toBeDefined();
      expect(h?.severity).toBe("warning");
    });

    it("tra 150 e 1200 caratteri -> good length-ok", () => {
      const text =
        "Nuova offerta per il mese di novembre dalle 10 alle 18. " +
        "Promozione speciale valida solo per i primi 50 clienti. " +
        "Prenota subito al negozio in via Roma 12 oppure online. " +
        "Non perdere questa occasione limitata.";
      const hints = analyzeSeoHints(text);
      const h = hints.find((x) => x.key === "length-ok");
      expect(h).toBeDefined();
      expect(h?.severity).toBe("good");
    });
  });

  describe("titolo di apertura", () => {
    it("prima riga corta senza punto finale -> good has-headline", () => {
      const text =
        "Promozione gomme invernali\n\n" +
        "Dal 1 novembre scambio gomme a 25 euro. Prenota subito al numero 0541-123456.";
      const hints = analyzeSeoHints(text);
      const h = hints.find((x) => x.key === "has-headline");
      expect(h).toBeDefined();
      expect(h?.severity).toBe("good");
    });

    it("prima riga con punto finale -> info no-headline", () => {
      const text =
        "Dal primo novembre partira la nuova promozione sulle gomme invernali per auto e furgoni. " +
        "Il prezzo e di 25 euro al pezzo compreso di montaggio. Prenota adesso.";
      const hints = analyzeSeoHints(text);
      // La prima riga finisce con punto -> no-headline atteso
      const h = hints.find((x) => x.key === "no-headline");
      expect(h).toBeDefined();
      expect(h?.severity).toBe("info");
    });
  });

  describe("call-to-action", () => {
    it("verbo imperativo (prenota) nelle ultime 2 frasi -> good has-cta", () => {
      const text =
        "Nuovo servizio di cambio gomme\n\n" +
        "Dal 15 novembre fissa il tuo appuntamento. Prenota adesso al numero 0541.";
      const hints = analyzeSeoHints(text);
      const h = hints.find((x) => x.key === "has-cta");
      expect(h).toBeDefined();
      expect(h?.severity).toBe("good");
    });

    it("nessun verbo imperativo rilevato -> warning no-cta", () => {
      const text =
        "Nuova offerta gomme invernali per il mese di novembre valida solo per i primi 50 clienti del negozio.";
      const hints = analyzeSeoHints(text);
      const h = hints.find((x) => x.key === "no-cta");
      expect(h).toBeDefined();
      expect(h?.severity).toBe("warning");
    });

    it("altri verbi CTA validi: scopri, chiamaci, iscriviti", () => {
      for (const cta of ["scopri", "chiamaci", "iscriviti", "visita", "contatta"]) {
        const text = `Nuova offerta.\n\nTesto esteso di prova. ${cta} per saperne di piu.`;
        const h = analyzeSeoHints(text).find((x) => x.key === "has-cta");
        expect(h, `CTA "${cta}" dovrebbe essere rilevata`).toBeDefined();
      }
    });
  });

  describe("numeri concreti", () => {
    it("prezzo in euro -> good has-concrete-numbers", () => {
      const text = "Promo del mese\n\nSconto del 20% su tutto. Pizza margherita a 7,50 euro.";
      const h = analyzeSeoHints(text).find((x) => x.key === "has-concrete-numbers");
      expect(h?.severity).toBe("good");
    });

    it("data (15 novembre) -> good has-concrete-numbers", () => {
      const text = "Nuova apertura\n\nDal 15 novembre siamo aperti il weekend.";
      const h = analyzeSeoHints(text).find((x) => x.key === "has-concrete-numbers");
      expect(h?.severity).toBe("good");
    });

    it("orario (dalle 9) -> good has-concrete-numbers", () => {
      const text = "Nuovo servizio\n\nSiamo aperti dalle 9 alle 18 tutti i giorni.";
      const h = analyzeSeoHints(text).find((x) => x.key === "has-concrete-numbers");
      expect(h?.severity).toBe("good");
    });

    it("nessun numero concreto -> info no-concrete-numbers", () => {
      const text =
        "Nuove novita in arrivo\n\nTante sorprese per i nostri clienti affezionati. Vieni a trovarci presto.";
      const h = analyzeSeoHints(text).find((x) => x.key === "no-concrete-numbers");
      expect(h?.severity).toBe("info");
    });
  });

  describe("densita parole chiave", () => {
    it("parola ripetuta >=4 volte -> warning high-density", () => {
      const text =
        "Pizza buona pizza fresca pizza napoletana pizza margherita. " +
        "Vieni a provare la nostra pizza.";
      const h = analyzeSeoHints(text).find((x) => x.key === "high-density");
      expect(h).toBeDefined();
      expect(h?.severity).toBe("warning");
      expect(h?.detail).toContain("pizza");
    });

    it("stop-words ripetute non triggerano density", () => {
      // "molto" e' una stop-word, non deve essere contata come keyword
      const text = "Il nostro prodotto e molto molto molto molto molto molto buono per voi.";
      const h = analyzeSeoHints(text).find((x) => x.key === "high-density");
      expect(h).toBeUndefined();
    });

    it("parole corte (<4 char) non triggerano density", () => {
      const text = "sol sol sol sol sol sol testo normale di prova e lunghezza media.";
      const h = analyzeSeoHints(text).find((x) => x.key === "high-density");
      expect(h).toBeUndefined();
    });
  });

  describe("frasi lunghe", () => {
    it("frase > 25 parole -> info long-sentences", () => {
      const text =
        "Titolo breve\n\n" +
        "Una frase molto molto lunga che continua con molte parole senza fermarsi mai perche vogliamo testare il limite dei venticinque termini che e il tetto suggerito. " +
        "Seconda frase corta. Terza frase breve.";
      const h = analyzeSeoHints(text).find((x) => x.key === "long-sentences");
      expect(h).toBeDefined();
      expect(h?.severity).toBe("info");
    });

    it("frasi corte uniformi -> nessun long-sentences", () => {
      const text =
        "Titolo breve\n\n" +
        "Prima frase corta. Seconda frase breve. Terza altrettanto. Prenota subito.";
      const h = analyzeSeoHints(text).find((x) => x.key === "long-sentences");
      expect(h).toBeUndefined();
    });
  });

  it("determinismo: stessa input -> stesso output", () => {
    const text =
      "Promozione del mese\n\nSconto del 20% su tutto dal 1 novembre. Prenota adesso al numero 0541.";
    const r1 = analyzeSeoHints(text);
    const r2 = analyzeSeoHints(text);
    expect(r1).toEqual(r2);
  });
});

describe("RF-13.7 · countBySeverity", () => {
  it("conta correttamente per severity", () => {
    const text =
      "Promozione del mese\n\nSconto del 20% su tutto dal 1 novembre. Prenota adesso al numero 0541.";
    const hints = analyzeSeoHints(text);
    const counts = countBySeverity(hints);
    expect(counts.good + counts.info + counts.warning).toBe(hints.length);
    expect(counts.good).toBeGreaterThan(0); // ha CTA + numeri + titolo
  });

  it("array vuoto -> tutti a zero", () => {
    expect(countBySeverity([])).toEqual({ good: 0, info: 0, warning: 0 });
  });
});
