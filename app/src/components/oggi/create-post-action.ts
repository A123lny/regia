"use server";

// Server action per la Home Oggi: riceve testo + marchio, classifica (avviso
// di servizio vs post sociale) e chiama ESATTAMENTE la stessa server action
// che userebbe l'utente dalla pagina marchio (/contenuti/<slug>/nuovo o
// /contenuti/<slug>/servizio). Ritorna l'esito al client, che gestisce la
// navigazione: in caso di errore il testo resta nel campo.

import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { getBrandBySlug } from "@/modules/m02-brand/public";
import {
  classifyTopicLabel,
  generateSocialPost,
  generateServiceCommunication,
} from "@/modules/m03-editorial/public";

export type StartNewPostResult =
  { ok: true; brandSlug: string; draftId: string } | { ok: false; error: string };

export async function startNewPostAction(input: {
  brandSlug: string;
  text: string;
}): Promise<StartNewPostResult> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "content.generate");

  const text = (input.text ?? "").slice(0, 2000).trim();
  if (text.length < 3) {
    return { ok: false, error: "Scrivi qualcosa in più (almeno 3 caratteri)." };
  }
  if (!input.brandSlug) {
    return { ok: false, error: "Scegli prima un marchio." };
  }

  const brand = await getBrandBySlug(session.organizationId, input.brandSlug);
  if (!brand) {
    return { ok: false, error: "Marchio non trovato o non accessibile." };
  }

  // Classifica il testo: "avviso" (orari, chiusure, nuovi servizi concreti) va
  // in Avviso rapido; tutto il resto in post sociale. Classificatore euristico
  // deterministico (zero costo AI), stessa logica di RF-12.2.
  const topicLabel = classifyTopicLabel(text);
  const isService = topicLabel === "avviso";

  if (isService) {
    // Il prompt service accetta max 500 caratteri: se l'utente ha scritto
    // più lungo, fallback su post sociale per non perdere l'input.
    if (text.length <= 500) {
      const result = await generateServiceCommunication(brand.id, text);
      if (result.ok) {
        return { ok: true, brandSlug: brand.slug, draftId: result.draft.id };
      }
      return { ok: false, error: result.error };
    }
  }

  const formData = new FormData();
  formData.set("themeInput", text);
  const result = await generateSocialPost(brand.id, formData);
  if (result.ok) {
    return { ok: true, brandSlug: brand.slug, draftId: result.draftId };
  }
  return { ok: false, error: result.error };
}
