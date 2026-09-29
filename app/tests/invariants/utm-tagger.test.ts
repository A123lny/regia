// RN-85 UTM utility — unit test puro (no DB).

import { describe, expect, it } from "vitest";
import {
  applyUtmToLinks,
  tagUrl,
  extractUrls,
  composeUtmForDraft,
} from "@/modules/m03-editorial/internal/utm-tagger";

const P = {
  utm_source: "instagram",
  utm_medium: "social",
  utm_campaign: "lenny-restaurant",
  utm_content: "draft-abc",
} as const;

describe("RN-85 · UTM tagger", () => {
  it("aggiunge tutti i param a URL senza query", () => {
    const out = tagUrl("https://lenny.example.com/menu", P);
    const u = new URL(out);
    expect(u.searchParams.get("utm_source")).toBe("instagram");
    expect(u.searchParams.get("utm_medium")).toBe("social");
    expect(u.searchParams.get("utm_campaign")).toBe("lenny-restaurant");
    expect(u.searchParams.get("utm_content")).toBe("draft-abc");
  });

  it("preserva query esistente", () => {
    const out = tagUrl("https://x.com/foo?a=1&b=2", P);
    const u = new URL(out);
    expect(u.searchParams.get("a")).toBe("1");
    expect(u.searchParams.get("b")).toBe("2");
    expect(u.searchParams.get("utm_source")).toBe("instagram");
  });

  it("NON sovrascrive utm_* preesistenti (override manuale)", () => {
    const out = tagUrl("https://x.com/foo?utm_source=facebook&utm_campaign=special", P);
    const u = new URL(out);
    expect(u.searchParams.get("utm_source")).toBe("facebook"); // preservato
    expect(u.searchParams.get("utm_campaign")).toBe("special"); // preservato
    expect(u.searchParams.get("utm_medium")).toBe("social"); // aggiunto (mancava)
    expect(u.searchParams.get("utm_content")).toBe("draft-abc"); // aggiunto
  });

  it("preserva fragment #anchor", () => {
    const out = tagUrl("https://x.com/foo#section-3", P);
    expect(out).toContain("#section-3");
    expect(out.indexOf("?")).toBeLessThan(out.indexOf("#"));
  });

  it("gestisce trailing punctuation (virgola, punto)", () => {
    const out = tagUrl("https://x.com/foo,", P);
    // Il trailing viene rimesso alla fine
    expect(out.endsWith(",")).toBe(true);
    // E l'URL prima del trailing è valido
    const withoutTail = out.slice(0, -1);
    expect(() => new URL(withoutTail)).not.toThrow();
  });

  it("ritorna URL malformato invariato", () => {
    const out = tagUrl("not a url", P);
    expect(out).toBe("not a url");
  });

  it("applyUtmToLinks: sostituisce tutti gli URL in un testo", () => {
    const text =
      "Scopri il menu su https://lenny.it/menu e prenota su http://prenotazioni.lenny.it/oggi.";
    const out = applyUtmToLinks(text, P);
    expect(out).toContain("utm_source=instagram");
    // Entrambi gli URL taggati
    const urls = extractUrls(out);
    expect(urls.length).toBe(2);
    for (const u of urls) {
      expect(u).toContain("utm_source=instagram");
      expect(u).toContain("utm_content=draft-abc");
    }
  });

  it("applyUtmToLinks: testo senza URL ritorna invariato", () => {
    const text = "Nessun link qui, solo testo.";
    expect(applyUtmToLinks(text, P)).toBe(text);
  });

  it("extractUrls: estrae in ordine di apparizione", () => {
    const urls = extractUrls("prima https://a.it e poi https://b.it/x");
    expect(urls).toEqual(["https://a.it", "https://b.it/x"]);
  });

  it("composeUtmForDraft: normalizza brand slug + platform", () => {
    const p = composeUtmForDraft({
      platformSource: "instagram",
      medium: "social",
      brandSlug: "lenny-market",
      draftId: "d1",
    });
    expect(p).toEqual({
      utm_source: "instagram",
      utm_medium: "social",
      utm_campaign: "lenny-market",
      utm_content: "d1",
    });
  });

  it("deterministico: stesso input → stesso output", () => {
    const text = "Prenota su https://lenny.it/menu oggi.";
    expect(applyUtmToLinks(text, P)).toBe(applyUtmToLinks(text, P));
  });
});
