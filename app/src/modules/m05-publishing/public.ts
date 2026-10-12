// M05 Publishing - interfaccia pubblica (RS-1).

export type {
  Channel,
  OutgoingMessage,
  EmailMessage,
  WhatsAppMessage,
  SendResult,
  PublishAdapter,
  AdapterCredentials,
} from "./internal/types";

export {
  PublishError,
  ConsentMissingError,
  ChannelDisabledError,
  PressureLimitError,
  BudgetExceededError,
  QueueFullError,
  DuplicateJobError,
} from "./internal/types";

export type { Job, JobStatus } from "./internal/publish-jobs-repo";

export {
  updateChannelCredentialsAction,
  setChannelEnabledAction,
  testChannelAction,
  listChannelsAction,
} from "./internal/actions";

// getAdapter, sendMessage, tickBatch sono in ./server.ts (barrel server-only,
// trascinano adapter-twilio -> twilio Node-only che non va bundlato nel client).

// RN-64..67 Unsubscribe flow
export {
  resolveUnsubscribeToken,
  revokeConsentFromToken,
  applyUnsubscribe,
  getUnsubscribePressureAlerts,
} from "./internal/unsubscribe-repo";
export type {
  UnsubscribeReason,
  ApplyUnsubscribeInput,
  ApplyUnsubscribeResult,
  PressureAlert,
  ResolvedToken,
} from "./internal/unsubscribe-repo";
