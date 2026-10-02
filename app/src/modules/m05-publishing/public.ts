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

export { getAdapter } from "./internal/adapter-registry";

export { sendMessage } from "./internal/send-message";
export type { SendMessageInput } from "./internal/send-message";
export type { Job, JobStatus } from "./internal/publish-jobs-repo";

export { tickBatch } from "./internal/worker";
export type { TickResult } from "./internal/worker";

export {
  updateChannelCredentialsAction,
  setChannelEnabledAction,
  testChannelAction,
  listChannelsAction,
} from "./internal/actions";

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
