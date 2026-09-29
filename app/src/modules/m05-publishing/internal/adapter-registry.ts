// M05 - factory adapter concreto per (channel, provider).
import type { PublishAdapter } from "./types";

// Le importazioni degli adapter concreti sono lazy per non richiedere Twilio/Resend
// SDK se il canale non e' configurato. Task 9-10 aggiungono le due implementazioni.

export async function getAdapter(channel: string, provider: string): Promise<PublishAdapter> {
  if (channel === "email" && provider === "resend") {
    const { ResendEmailAdapter } = await import("./adapter-resend");
    return new ResendEmailAdapter();
  }
  if (channel === "whatsapp" && provider === "twilio") {
    const { TwilioWhatsAppAdapter } = await import("./adapter-twilio");
    return new TwilioWhatsAppAdapter();
  }
  throw new Error(`No adapter for channel=${channel} provider=${provider}`);
}
