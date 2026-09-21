// M03 — Composer prompt per image AI (M4-γ RF-4.5).
// Funzione pura: nessun I/O, nessun side-effect.

import { loadPromptTemplate } from "./prompt-loader";

export const IMAGE_PROMPT_VERSION = "image-prompt-v1";

export type ComposeImagePromptInput = {
  brandDisplayName: string;
  brandContext: string;
  postText: string;
};

export function composeImagePromptSystemMessage(): string {
  return loadPromptTemplate("image-prompt");
}

export function composeImagePromptUserMessage(input: ComposeImagePromptInput): string {
  return (
    `Marchio: ${input.brandDisplayName}\n\n` +
    `Contesto visivo del marchio:\n${input.brandContext}\n\n` +
    `Testo del post social:\n${input.postText}\n\n` +
    `Componi il prompt inglese per l'immagine.`
  );
}
