// M10 · submitPublicSignup: dedup contatto per email + upsert consenso.

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { submitPublicSignup } from "@/modules/m10-signup/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("M10 · dedup contatto + consenso RF-1.4", () => {
  let orgId: string;
  let brandId: string;
  const landingSlug = `test-dedup-${Date.now()}`;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — dedup" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-dedup-${orgId.slice(0, 8)}`,
        display_name: "Brand dedup",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;

    await admin.from("signup_landings").insert({
      organization_id: orgId,
      brand_id: brandId,
      slug: landingSlug,
      headline: "Test dedup",
      benefit_headline: "Benefit",
      is_active: true,
    });
  });

  it("primo signup crea contatto + consenso email", async () => {
    const result = await submitPublicSignup({
      landingSlug,
      email: "dedup-test@example.com",
      firstName: "Mario",
      channelsGranted: ["email"],
    });
    expect(result.ok).toBe(true);

    // Verifica: 1 contatto creato
    const { data: contacts } = await admin
      .from("contacts")
      .select("id, first_name, email")
      .eq("organization_id", orgId)
      .ilike("email", "dedup-test@example.com");
    expect((contacts ?? []).length).toBe(1);

    // Verifica: consenso email granted
    const contactId = (contacts![0] as { id: string }).id;
    const { data: consents } = await admin
      .from("contact_consents")
      .select("channel, status")
      .eq("contact_id", contactId);
    const emailConsent = ((consents ?? []) as Array<{ channel: string; status: string }>).find(
      (c) => c.channel === "email",
    );
    expect(emailConsent?.status).toBe("granted");
  });

  it("secondo signup stessa email → NO duplicato contatto, aggiunge SMS consent", async () => {
    const result = await submitPublicSignup({
      landingSlug,
      email: "dedup-test@example.com",
      phone: "+39 123456789",
      channelsGranted: ["email", "sms"],
    });
    expect(result.ok).toBe(true);

    // Verifica: SEMPRE 1 contatto (no duplicato)
    const { data: contacts } = await admin
      .from("contacts")
      .select("id, phone")
      .eq("organization_id", orgId)
      .ilike("email", "dedup-test@example.com");
    expect((contacts ?? []).length).toBe(1);
    // Phone aggiunto perché prima era null (normalizePhone rimuove spazi)
    expect((contacts![0] as { phone: string | null }).phone).toBe("+39123456789");

    // Consenso SMS ora granted
    const contactId = (contacts![0] as { id: string }).id;
    const { data: consents } = await admin
      .from("contact_consents")
      .select("channel, status")
      .eq("contact_id", contactId);
    const smsConsent = ((consents ?? []) as Array<{ channel: string; status: string }>).find(
      (c) => c.channel === "sms",
    );
    expect(smsConsent?.status).toBe("granted");
  });

  it("submit senza recapiti → invalid_input", async () => {
    const result = await submitPublicSignup({
      landingSlug,
      firstName: "Nome",
      channelsGranted: ["email"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("invalid_input");
  });

  it("consenso email senza email → invalid_input", async () => {
    const result = await submitPublicSignup({
      landingSlug,
      phone: "+39 000",
      channelsGranted: ["email"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("invalid_input");
  });

  it("landing slug inesistente → landing_missing", async () => {
    const result = await submitPublicSignup({
      landingSlug: "landing-che-non-esiste-mai",
      email: "test@example.com",
      channelsGranted: ["email"],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("landing_missing");
  });

  it("honeypot compilato → rifiuto", async () => {
    const result = await submitPublicSignup({
      landingSlug,
      email: "bot@example.com",
      channelsGranted: ["email"],
      honeypot: "https://bot.example.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("honeypot");
  });
});
