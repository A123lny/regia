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

// Server actions e sendMessage arrivano nei task successivi.
