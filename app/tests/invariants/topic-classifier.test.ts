// RF-12.2 topic_label classifier — unit test puro (no DB).

import { describe, expect, it } from "vitest";
import {
  classifyTopicLabel,
  TOPIC_LABELS,
} from "@/modules/m03-editorial/internal/topic-classifier";

describe("RF-12.2 · topic classifier", () => {
  it("prefisso [SERVIZIO] → avviso", () => {
    expect(classifyTopicLabel("[SERVIZIO] Chiusura per ferie")).toBe("avviso");
  });

  it("prefisso [RICORRENZA:natale] → ricorrenza", () => {
    expect(classifyTopicLabel("[RICORRENZA:natale] Chiusura 25 dicembre")).toBe("ricorrenza");
  });

  it("keyword officina", () => {
    expect(classifyTopicLabel("Nuovo servizio di cambio gomme in officina")).toBe("officina");
  });

  it("keyword bar", () => {
    expect(classifyTopicLabel("Menu di colazione: caffè + brioche a 2 euro")).toBe("bar");
  });

  it("keyword consegna", () => {
    expect(classifyTopicLabel("La consegna a domicilio ora anche il sabato")).toBe("consegna");
  });

  it("keyword promozione", () => {
    expect(classifyTopicLabel("Voucher regalo per i clienti abituali")).toBe("promozione");
  });

  it("keyword avviso (chiusura)", () => {
    expect(classifyTopicLabel("Cambio orario apertura da lunedi prossimo")).toBe("avviso");
  });

  it("fallback altro se nessun match", () => {
    expect(classifyTopicLabel("Contenuto generico senza parole chiave")).toBe("altro");
  });

  it("classifier è deterministico", () => {
    const input = "Nuova promozione: sconto sul menu del bar";
    expect(classifyTopicLabel(input)).toBe(classifyTopicLabel(input));
  });

  it("case insensitive", () => {
    expect(classifyTopicLabel("PROMOZIONE speciale")).toBe("promozione");
    expect(classifyTopicLabel("promozione speciale")).toBe("promozione");
    expect(classifyTopicLabel("Promozione Speciale")).toBe("promozione");
  });

  it("tutte le label restituite sono nell'enum", () => {
    const samples = [
      "[SERVIZIO] chiuso",
      "cambio gomme",
      "caffè",
      "delivery",
      "sconto",
      "orario nuovo",
      "[RICORRENZA:pasqua] test",
      "testo casuale",
    ];
    for (const s of samples) {
      const l = classifyTopicLabel(s);
      expect((TOPIC_LABELS as readonly string[]).includes(l)).toBe(true);
    }
  });

  it("theme_input vuoto → altro", () => {
    expect(classifyTopicLabel("")).toBe("altro");
    expect(classifyTopicLabel("   ")).toBe("altro");
  });
});
