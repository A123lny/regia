// M07 Outreach — interfaccia pubblica (RS-1).

export type {
  ContactSegment,
  Campaign,
  SegmentCriteria,
  CampaignChannel,
  CampaignStatus,
  ConsentChannel,
} from "./internal/outreach-types";

export {
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CONSENT_CHANNEL_LABELS,
  summarizeCriteria,
} from "./internal/outreach-types";

// Queries
export { listSegments, getSegment, refreshSegmentCount } from "./internal/segments-repo";
export type { SegmentRow } from "./internal/segments-repo";

export { listCampaigns, getCampaign } from "./internal/campaigns-repo";
export type { CampaignRow } from "./internal/campaigns-repo";

export { countMatchingContacts } from "./internal/segment-evaluator";

// Server actions
export {
  upsertSegmentAction,
  refreshSegmentAction,
  previewSegmentAction,
  upsertCampaignAction,
  markCampaignSentAction,
  cancelCampaignAction,
} from "./internal/actions";
export type {
  UpsertSegmentActionInput,
  UpsertCampaignActionInput,
  MarkCampaignSentInput,
} from "./internal/actions";
