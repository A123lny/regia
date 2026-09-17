// M03 — Motore editoriale. Interfaccia pubblica (RS-1).
// Tutto ciò che non è esportato qui è privato: non importarlo da fuori.

// Types
export type {
  ContentDraft,
  ContentDraftStatus,
  ContentChannel,
} from "./internal/content-drafts-types";

// Query (server components / RSC)
export { listContentDraftsByBrand, getContentDraft } from "./internal/content-drafts-repo";

// Server actions (form submit)
export { generateSocialPost, approveContentDraft, rejectContentDraft } from "./internal/actions";
