// M05 - adapter Email via Resend (RS-2).
import { Resend } from "resend";
import type { PublishAdapter, OutgoingMessage, EmailMessage, SendResult, AdapterCredentials } from "./types";

export class ResendEmailAdapter implements PublishAdapter {
  readonly channel = "email" as const;
  readonly provider = "resend";

  async send(input: OutgoingMessage, credentials: AdapterCredentials): Promise<SendResult> {
    if (input.channel !== "email") throw new Error("ResendEmailAdapter: input non e' email");
    const msg = input as EmailMessage;
    const client = new Resend(credentials.apiKey);
    const payload: { from: string; to: string; subject: string; html: string; text?: string; replyTo?: string } = {
      from: msg.from, to: msg.to, subject: msg.subject, html: msg.html,
    };
    if (msg.text) payload.text = msg.text;
    if (msg.replyTo) payload.replyTo = msg.replyTo;
    const { data, error } = await client.emails.send(payload);
    if (error) throw new Error(`Resend send: ${error.message}`);
    if (!data?.id) throw new Error("Resend send: nessun id restituito");
    return { externalId: data.id, costCents: 4 };  // Resend ~$0.40/1000 email = 0.04c/email arrotondato a 4c
  }

  async ping(credentials: AdapterCredentials): Promise<{ ok: true } | { ok: false; error: string }> {
    const client = new Resend(credentials.apiKey);
    try {
      // Resend API: GET /domains ritorna array. Se key invalida, 401.
      const domains = await client.domains.list();
      if (domains.error) return { ok: false, error: domains.error.message };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async estimateCost(_input: OutgoingMessage): Promise<number> {
    return 4;  // Resend flat pricing
  }

  async getStatus(externalId: string, credentials: AdapterCredentials): Promise<"sent" | "delivered" | "failed" | "unknown"> {
    const client = new Resend(credentials.apiKey);
    try {
      const { data, error } = await client.emails.get(externalId);
      if (error || !data) return "unknown";
      if (data.last_event === "delivered") return "delivered";
      if (data.last_event === "bounced" || data.last_event === "complained") return "failed";
      if (data.last_event === "sent") return "sent";
      return "unknown";
    } catch { return "unknown"; }
  }
}
