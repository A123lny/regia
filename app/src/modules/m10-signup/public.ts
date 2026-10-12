// M10 Signup — interfaccia pubblica (RS-1).

export type {
  SignupLanding,
  SignupEvent,
  AudienceKind,
  ConsentChannel,
  SignupSourceHint,
} from "./internal/signup-types";

export {
  AUDIENCE_KIND_LABELS,
  CONSENT_CHANNEL_LABELS,
  SIGNUP_SOURCE_LABELS,
} from "./internal/signup-types";

// Queries
export { listLandings, getLandingById, getPublicLandingBySlug } from "./internal/landings-repo";
export type { LandingRow } from "./internal/landings-repo";

export { listSignupEvents, getSignupStats } from "./internal/events-repo";
export type { EventRow } from "./internal/events-repo";

// Admin actions
export { upsertLandingAction, archiveLandingAction } from "./internal/admin-actions";
export type { UpsertLandingActionInput } from "./internal/admin-actions";

// submitPublicSignup e' in ./server.ts (barrel server-only, trascina
// m09-reminders/server + m05-publishing adapter twilio).
