import type { ContentDraft } from "@/modules/m03-editorial/public";

export type ScheduledDraftWithUrl = ContentDraft & { imageSignedUrl: string | null };
