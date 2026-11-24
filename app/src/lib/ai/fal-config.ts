// Configurazione fal.ai (modelli, size per canale, costi stimati).
// Il file è importabile sia server che client (non esporta la chiave).
// La chiave FAL_KEY sta solo nelle env server; mai nel bundle browser.

export type FalImageModelId = "fal-ai/flux/schnell" | "fal-ai/flux-pro/v1.1";

// Modello veloce per le 2–4 anteprime (Apache 2.0, ~2s, basso costo).
export const FAL_PREVIEW_MODEL: FalImageModelId = "fal-ai/flux/schnell";
// Modello di qualità per la variante finale scelta dall'utente.
export const FAL_QUALITY_MODEL: FalImageModelId = "fal-ai/flux-pro/v1.1";

// Numero di anteprime generate al click "Genera anteprime".
export const FAL_PREVIEW_COUNT = 4;

// Costo stimato per immagine, aggiornato ai prezzi listati fal.ai (nov 2026).
// Usato solo per preflight budget check; il costo reale viene letto dalla
// risposta fal se presente (campo `timings`/`cost` non sempre disponibile).
export const FAL_COST_USD: Record<FalImageModelId, number> = {
  "fal-ai/flux/schnell": 0.003,
  "fal-ai/flux-pro/v1.1": 0.04,
};

// Formato in base al canale della bozza. Dimensioni allineate agli standard IG/FB.
export type FalImageSize = {
  width: number;
  height: number;
  label: string;
};

export type DraftChannelHint = "instagram_post" | "instagram_story" | "facebook_link" | "generic";

export const FAL_SIZE_BY_CHANNEL: Record<DraftChannelHint, FalImageSize> = {
  instagram_post: { width: 1024, height: 1024, label: "Instagram post (1:1)" },
  instagram_story: { width: 768, height: 1344, label: "Story / Reel (9:16)" },
  facebook_link: { width: 1200, height: 628, label: "Facebook link (1.91:1)" },
  generic: { width: 1024, height: 1024, label: "Social generico (1:1)" },
};

// Slug del provider media richiesto in media_providers per abilitare fal.
// Allineato al punto 3 della spec: senza record attivo con questo slug,
// la generazione esterna è disabilitata (resta solo "Da template").
export const FAL_PROVIDER_SLUG = "fal-ai";
