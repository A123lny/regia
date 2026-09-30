// M05 - adapter WhatsApp via Twilio (RS-2, RF-5.4).
import twilio from "twilio";
import type { PublishAdapter, OutgoingMessage, WhatsAppMessage, SendResult, AdapterCredentials } from "./types";

export class TwilioWhatsAppAdapter implements PublishAdapter {
  readonly channel = "whatsapp" as const;
  readonly provider = "twilio";

  async send(input: OutgoingMessage, credentials: AdapterCredentials): Promise<SendResult> {
    if (input.channel !== "whatsapp") throw new Error("TwilioWhatsAppAdapter: input non e' whatsapp");
    const msg = input as WhatsAppMessage;
    const accountSid = credentials.config["accountSid"] as string;
    if (!accountSid) throw new Error("Twilio: accountSid mancante in config");
    const client = twilio(accountSid, credentials.apiKey);
    const message = await client.messages.create({
      contentSid: msg.templateSid,
      contentVariables: JSON.stringify(msg.variables),
      from: `whatsapp:${msg.from}`,
      to: `whatsapp:${msg.to}`,
    });
    if (message.errorCode) throw new Error(`Twilio ${message.errorCode}: ${message.errorMessage}`);
    return { externalId: message.sid, costCents: 5 };  // Twilio WA ~$0.005/msg utility Italia
  }

  async ping(credentials: AdapterCredentials): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const accountSid = credentials.config["accountSid"] as string;
      if (!accountSid) return { ok: false, error: "accountSid mancante in config" };
      const client = twilio(accountSid, credentials.apiKey);
      const acct = await client.api.v2010.accounts(accountSid).fetch();
      if (acct.status !== "active") return { ok: false, error: `Account Twilio status: ${acct.status}` };
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async estimateCost(_input: OutgoingMessage): Promise<number> {
    return 5;  // Approssimazione WA utility. In produzione dovremmo distinguere marketing vs utility.
  }

  async getStatus(externalId: string, credentials: AdapterCredentials): Promise<"sent" | "delivered" | "failed" | "unknown"> {
    try {
      const accountSid = credentials.config["accountSid"] as string;
      const client = twilio(accountSid, credentials.apiKey);
      const msg = await client.messages(externalId).fetch();
      if (msg.status === "delivered" || msg.status === "read") return "delivered";
      if (msg.status === "failed" || msg.status === "undelivered") return "failed";
      if (msg.status === "sent") return "sent";
      return "unknown";
    } catch { return "unknown"; }
  }
}
