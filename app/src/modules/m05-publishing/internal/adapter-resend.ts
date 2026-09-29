// M05 - Resend Email Adapter (placeholder, implemented in Task 10)
import type { PublishAdapter, OutgoingMessage, AdapterCredentials, SendResult } from "./types";

export class ResendEmailAdapter implements PublishAdapter {
  readonly channel = "email" as const;
  readonly provider = "resend";

  async send(_input: OutgoingMessage, _credentials: AdapterCredentials): Promise<SendResult> {
    throw new Error("ResendEmailAdapter not yet implemented (Task 10)");
  }

  async ping(_credentials: AdapterCredentials): Promise<{ ok: true } | { ok: false; error: string }> {
    throw new Error("ResendEmailAdapter not yet implemented (Task 10)");
  }

  async estimateCost(_input: OutgoingMessage): Promise<number> {
    throw new Error("ResendEmailAdapter not yet implemented (Task 10)");
  }

  async getStatus(_externalId: string, _credentials: AdapterCredentials): Promise<"sent" | "delivered" | "failed" | "unknown"> {
    throw new Error("ResendEmailAdapter not yet implemented (Task 10)");
  }
}
