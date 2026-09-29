// M05 Publishing - tipi condivisi (RS-2 interfaccia adapter).

export type Channel = "email" | "whatsapp" | "sms" | "facebook" | "instagram" | "google";

export type EmailMessage = {
  channel: "email";
  to: string;
  subject: string;
  html: string;
  text?: string;
  from: string;
  replyTo?: string;
};

export type WhatsAppMessage = {
  channel: "whatsapp";
  to: string;  // E.164 phone
  templateSid: string;
  variables: Record<string, string>;
  from: string;  // sender phone Twilio
};

export type OutgoingMessage = EmailMessage | WhatsAppMessage;

export type SendResult = {
  externalId: string;
  costCents: number;
};

export type AdapterCredentials = {
  apiKey: string;
  config: Record<string, unknown>;  // account_sid, from_number, from_email...
};

/**
 * RS-2 · unica porta verso servizi esterni di publishing.
 * Ogni provider concreto (Twilio, Resend, ...) implementa questa interfaccia.
 */
export interface PublishAdapter {
  readonly channel: Channel;
  readonly provider: string;

  send(input: OutgoingMessage, credentials: AdapterCredentials): Promise<SendResult>;
  ping(credentials: AdapterCredentials): Promise<{ ok: true } | { ok: false; error: string }>;
  estimateCost(input: OutgoingMessage): Promise<number>;
  getStatus(externalId: string, credentials: AdapterCredentials): Promise<"sent" | "delivered" | "failed" | "unknown">;
}

export class PublishError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "PublishError"; }
}
export class ConsentMissingError extends PublishError { constructor(msg: string) { super("CONSENT_MISSING", msg); } }
export class ChannelDisabledError extends PublishError { constructor(msg: string) { super("CHANNEL_DISABLED", msg); } }
export class PressureLimitError extends PublishError { constructor(msg: string) { super("PRESSURE_LIMIT", msg); } }
export class BudgetExceededError extends PublishError { constructor(msg: string) { super("BUDGET_EXCEEDED", msg); } }
export class QueueFullError extends PublishError { constructor(msg: string) { super("QUEUE_FULL", msg); } }
export class DuplicateJobError extends PublishError { constructor(msg: string) { super("DUPLICATE_JOB", msg); } }
