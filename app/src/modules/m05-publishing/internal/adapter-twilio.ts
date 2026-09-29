// M05 - Twilio WhatsApp Adapter (placeholder, implemented in Task 9)
import type { PublishAdapter, OutgoingMessage, AdapterCredentials, SendResult } from "./types";

export class TwilioWhatsAppAdapter implements PublishAdapter {
  readonly channel = "whatsapp" as const;
  readonly provider = "twilio";

  async send(_input: OutgoingMessage, _credentials: AdapterCredentials): Promise<SendResult> {
    throw new Error("TwilioWhatsAppAdapter not yet implemented (Task 9)");
  }

  async ping(_credentials: AdapterCredentials): Promise<{ ok: true } | { ok: false; error: string }> {
    throw new Error("TwilioWhatsAppAdapter not yet implemented (Task 9)");
  }

  async estimateCost(_input: OutgoingMessage): Promise<number> {
    throw new Error("TwilioWhatsAppAdapter not yet implemented (Task 9)");
  }

  async getStatus(_externalId: string, _credentials: AdapterCredentials): Promise<"sent" | "delivered" | "failed" | "unknown"> {
    throw new Error("TwilioWhatsAppAdapter not yet implemented (Task 9)");
  }
}
