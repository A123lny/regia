import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { getAdminClient } from "@/lib/db/admin";
import { getChannelForReminderKind } from "@/modules/m09-reminders/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = getAdminClient() as any;

describe("M09 â†’ M05 integration", () => {
  describe("getChannelForReminderKind (mapping statico)", () => {
    it("WA + utility=non-promo per kind utilita (RF-5.5a)", () => {
      expect(getChannelForReminderKind("welcome")).toEqual({
        channel: "whatsapp",
        isPromotional: false,
      });
      expect(getChannelForReminderKind("thanks_order")).toEqual({
        channel: "whatsapp",
        isPromotional: false,
      });
      expect(getChannelForReminderKind("service_call")).toEqual({
        channel: "whatsapp",
        isPromotional: false,
      });
      expect(getChannelForReminderKind("voucher_expiring")).toEqual({
        channel: "whatsapp",
        isPromotional: false,
      });
      expect(getChannelForReminderKind("counter_close")).toEqual({
        channel: "whatsapp",
        isPromotional: false,
      });
    });
    it("Email + promo=true per dormant_reactivation (non puo' andare su WA)", () => {
      expect(getChannelForReminderKind("dormant_reactivation")).toEqual({
        channel: "email",
        isPromotional: true,
      });
    });
    it("Email + promo=false per review_request", () => {
      expect(getChannelForReminderKind("review_request")).toEqual({
        channel: "email",
        isPromotional: false,
      });
    });
  });

  describe("Trigger m09_sync_reminder_from_publish_log", () => {
    let orgId: string;
    let brandId: string;
    let contactId: string;
    let reminderId: string;
    let jobId: string;

    beforeAll(async () => {
      // Setup org + brand + contact + reminder + publish_job
      const org = await admin
        .from("organizations")
        .insert({ name: "Test M09â†’M05" })
        .select("id")
        .single();
      if (org.error || !org.data) throw new Error(`setup org: ${org.error?.message}`);
      orgId = org.data.id;
      const brand = await admin
        .from("brands")
        .insert({
          organization_id: orgId,
          slug: `b-${orgId.slice(0, 8)}`,
          display_name: "B",
        })
        .select("id")
        .single();
      if (brand.error || !brand.data) throw new Error(`setup brand: ${brand.error?.message}`);
      brandId = brand.data.id;
      const contact = await admin
        .from("contacts")
        .insert({
          organization_id: orgId,
          brand_id: brandId,
          first_name: "Mario",
          email: "mario@test.it",
          phone: "+393331234567",
          source: "manuale",
        })
        .select("id")
        .single();
      if (contact.error || !contact.data)
        throw new Error(`setup contact: ${contact.error?.message}`);
      contactId = contact.data.id;
      const rem = await admin
        .from("reminders")
        .insert({
          organization_id: orgId,
          brand_id: brandId,
          contact_id: contactId,
          kind: "voucher_expiring",
          scheduled_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (rem.error || !rem.data) throw new Error(`setup reminder: ${rem.error?.message}`);
      reminderId = rem.data.id;
      const job = await admin
        .from("m05_publish_jobs")
        .insert({
          organization_id: orgId,
          channel: "whatsapp",
          provider: "twilio",
          recipient_contact_id: contactId,
          recipient_address: "+393331234567",
          source_kind: "reminder",
          source_id: reminderId,
          payload: {
            channel: "whatsapp",
            to: "+393331234567",
            templateSid: "HX_test",
            variables: {},
            from: "+123",
          },
          is_promotional: false,
        })
        .select("id")
        .single();
      if (job.error || !job.data) throw new Error(`setup job: ${job.error?.message}`);
      jobId = job.data.id;
    });

    it("INSERT su m05_publish_log con status=sent + source_kind=reminder aggiorna reminders.sent_at", async () => {
      await admin.from("m05_publish_log").insert({
        organization_id: orgId,
        job_id: jobId,
        channel: "whatsapp",
        provider: "twilio",
        recipient_contact_id: contactId,
        recipient_address: "+393331234567",
        content_snapshot: { templateSid: "HX_test" },
        status: "sent",
      });
      // Verifica che reminder sia stato aggiornato dal trigger
      const { data } = await admin
        .from("reminders")
        .select("status, sent_at, last_send_error")
        .eq("id", reminderId)
        .single();
      expect(data.status).toBe("sent");
      expect(data.sent_at).not.toBeNull();
      expect(data.last_send_error).toBeNull();
    });

    it("INSERT su m05_publish_log con status=failed scrive last_send_error (reminder resta pending)", async () => {
      // Crea nuovo reminder + job separati
      const { data: rem2 } = await admin
        .from("reminders")
        .insert({
          organization_id: orgId,
          brand_id: brandId,
          contact_id: contactId,
          kind: "service_call",
          scheduled_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      const { data: job2 } = await admin
        .from("m05_publish_jobs")
        .insert({
          organization_id: orgId,
          channel: "whatsapp",
          provider: "twilio",
          recipient_contact_id: contactId,
          recipient_address: "+393331234567",
          source_kind: "reminder",
          source_id: rem2.id,
          payload: {
            channel: "whatsapp",
            to: "+393331234567",
            templateSid: "HX2",
            variables: {},
            from: "+123",
          },
          is_promotional: false,
        })
        .select("id")
        .single();
      await admin.from("m05_publish_log").insert({
        organization_id: orgId,
        job_id: job2.id,
        channel: "whatsapp",
        provider: "twilio",
        recipient_contact_id: contactId,
        recipient_address: "+393331234567",
        content_snapshot: {},
        status: "failed",
        provider_response: { error: "Twilio errore 63016 template non approvato" },
      });
      const { data } = await admin
        .from("reminders")
        .select("status, last_send_error, publish_job_id")
        .eq("id", rem2.id)
        .single();
      expect(data.status).toBe("pending"); // resta pending per retry
      expect(data.last_send_error).toContain("63016");
      expect(data.publish_job_id).toBeNull(); // liberato per retry
    });

    it("INSERT log con source_kind != 'reminder' non tocca reminders", async () => {
      // Nuovo job source_kind=test
      const { data: testJob } = await admin
        .from("m05_publish_jobs")
        .insert({
          organization_id: orgId,
          channel: "email",
          provider: "resend",
          recipient_contact_id: null,
          recipient_address: "x@y.it",
          source_kind: "test",
          source_id: randomUUID(),
          payload: { channel: "email", to: "x@y.it", subject: "s", html: "h", from: "a@x" },
        })
        .select("id")
        .single();
      const { data: beforeRem } = await admin
        .from("reminders")
        .select("status")
        .eq("id", reminderId)
        .single();
      await admin.from("m05_publish_log").insert({
        organization_id: orgId,
        job_id: testJob.id,
        channel: "email",
        provider: "resend",
        recipient_address: "x@y.it",
        content_snapshot: {},
        status: "sent",
      });
      const { data: afterRem } = await admin
        .from("reminders")
        .select("status")
        .eq("id", reminderId)
        .single();
      // Reminder originale non deve cambiare (gia' sent) e nessun'altra deve essere toccata
      expect(afterRem.status).toBe(beforeRem.status);
    });
  });
});
