// M08 Analytics — interfaccia pubblica (RS-1). Solo lettura, nessuna action.

export type {
  AnalyticsPeriod,
  ContactsAnalytics,
  OrdersAnalytics,
  LoyaltyAnalytics,
  OutreachAnalytics,
  PartnersAnalytics,
  SignupAnalytics,
} from "./internal/analytics-types";

export { PERIOD_LABELS, PERIOD_DAYS } from "./internal/analytics-types";

export { getContactsAnalytics } from "./internal/contacts-analytics";
export { getOrdersAnalytics } from "./internal/orders-analytics";
export { getLoyaltyAnalytics } from "./internal/loyalty-analytics";
export { getOutreachAnalytics } from "./internal/outreach-analytics";
export { getPartnersAnalytics } from "./internal/partners-analytics";
export { getSignupAnalytics } from "./internal/signup-analytics";

// RF-9.3 attribuzione contenuto -> vendita
export { getAttributionByDraft } from "./internal/attribution-repo";
export type { DraftAttribution, AttributionSummary } from "./internal/attribution-repo";
