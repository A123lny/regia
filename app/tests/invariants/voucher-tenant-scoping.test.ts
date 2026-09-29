// RS-3 RN-87 · getVoucher / getVoucherByCode filtrano su organization_id (IDOR).

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getVoucher, getVoucherByCode, listVouchers } from "@/modules/m06-loyalty/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("voucher: tenant scoping IDOR (RS-3, RN-87)", () => {
  let voucherIdOrgA: string;
  let voucherCodeOrgA: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — voucher-tenant" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup org-A: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — voucher-tenant" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup org-B: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-vt-${orgAId.slice(0, 8)}`,
        display_name: "Brand A",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data) throw new Error(`Setup brand: ${brandA.error?.message}`);
    const brandIdA = (brandA.data as { id: string }).id;

    const contact = await admin
      .from("contacts")
      .insert({
        organization_id: orgAId,
        brand_id: brandIdA,
        first_name: "VT",
        email: "vt@example.it",
        source: "manuale",
      })
      .select("id")
      .single();
    if (contact.error || !contact.data) throw new Error(`Setup contact: ${contact.error?.message}`);

    const offer = await admin
      .from("voucher_offers")
      .insert({
        organization_id: orgAId,
        issuer_brand_id: brandIdA,
        spendable_brand_id: brandIdA,
        name: "Offer VT",
        reward_kind: "valore_fisso",
        reward_value_cents: 500,
        default_expires_days: 60,
      })
      .select("id")
      .single();
    if (offer.error || !offer.data) throw new Error(`Setup offer: ${offer.error?.message}`);

    voucherCodeOrgA = "IDOR" + orgAId.slice(0, 4).toUpperCase();
    const voucher = await admin
      .from("vouchers")
      .insert({
        organization_id: orgAId,
        offer_id: (offer.data as { id: string }).id,
        contact_id: (contact.data as { id: string }).id,
        code: voucherCodeOrgA,
        reward_kind: "valore_fisso",
        reward_value_cents: 500,
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (voucher.error || !voucher.data) throw new Error(`Setup voucher: ${voucher.error?.message}`);
    voucherIdOrgA = (voucher.data as { id: string }).id;
  });

  it("getVoucher(id, orgB) → null (IDOR bloccato)", async () => {
    const result = await getVoucher(voucherIdOrgA, orgBId);
    expect(result).toBeNull();
  });

  it("getVoucher(id, orgA) → voucher (legittimo)", async () => {
    const result = await getVoucher(voucherIdOrgA, orgAId);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(voucherIdOrgA);
  });

  it("getVoucherByCode(code, orgB) → null (codice esiste ma appartiene ad altra org)", async () => {
    const result = await getVoucherByCode(voucherCodeOrgA, orgBId);
    expect(result).toBeNull();
  });

  it("listVouchers(orgB) non include voucher di orgA", async () => {
    const { items } = await listVouchers({ organizationId: orgBId });
    const found = items.find((v) => v.id === voucherIdOrgA);
    expect(found).toBeUndefined();
  });
});
