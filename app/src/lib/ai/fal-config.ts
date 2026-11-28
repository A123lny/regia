// Configurazione fal.ai (modelli, size per canale, costi stimati).
// Il file è importabile sia server che client (non esporta la chiave).
// La chiave FAL_KEY sta solo nelle env server; mai nel bundle browser.

export type FalImageModelId =
  | "fal-ai/flux/schnell"
  | "fal-ai/flux-pro/v1.1"
  | "fal-ai/flux-lora";

// Modello veloce per le 2–4 anteprime (Apache 2.0, ~2s, basso costo).
export const FAL_PREVIEW_MODEL: FalImageModelId = "fal-ai/flux/schnell";
// Modello di qualità per la variante finale scelta dall'utente.
export const FAL_QUALITY_MODEL: FalImageModelId = "fal-ai/flux-pro/v1.1";
// Modello che accetta loras[]: usato quando brand_kit.lora_model_url è
// valorizzato, in modo che le generazioni applichino lo stile addestrato
// (vedi lora-training-actions.ts). Pricing simile a flux/dev.
export const FAL_LORA_MODEL: FalImageModelId = "fal-ai/flux-lora";

// Numero di anteprime generate al click "Genera anteprime".
export const FAL_PREVIEW_COUNT = 4;

// Costo stimato per immagine, aggiornato ai prezzi listati fal.ai (nov 2026).
export const FAL_COST_USD: Record<FalImageModelId, number> = {
  "fal-ai/flux/schnell": 0.003,
  "fal-ai/flux-pro/v1.1": 0.04,
  "fal-ai/flux-lora": 0.025,
};

// ─── Video (image-to-video) ───────────────────────────────────────────────
// Endpoint fal video image-to-video. Kling 2.0 e Veo-3 sono fra i più usati
// (verifica listino aggiornato su fal.ai/models). Scelta operativa: kling
// (più economico, ~$0.10 per 5s 9:16) per il primo roll-out.
export type FalVideoModelId = "fal-ai/kling-video/v2/master/image-to-video";
export const FAL_VIDEO_MODEL: FalVideoModelId = "fal-ai/kling-video/v2/master/image-to-video";
export const FAL_VIDEO_COST_USD = 0.1; // stima per 5s
// Timeout polling long-running: video sincrono può superare la finestra
// Vercel (300s max). Qui usiamo queue.submit + status polling.
export const FAL_VIDEO_DEFAULT_DURATION_S = 5;
export const FAL_VIDEO_DEFAULT_ASPECT = "9:16" as const;

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
