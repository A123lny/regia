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
