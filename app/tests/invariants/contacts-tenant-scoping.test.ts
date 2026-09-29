// RS-3 RN-87 · getContact filtra su organization_id (IDOR cross-tenant impossibile).

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getContact, listContacts } from "@/modules/m01-data-hub/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("contacts: tenant scoping IDOR (RS-3, RN-87)", () => {
  let contactIdOrgA: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — contacts" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup org-A: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — contacts" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup org-B: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-contacts-${orgAId.slice(0, 8)}`,
        display_name: "Brand A",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data) throw new Error(`Setup brand-A: ${brandA.error?.message}`);

    const contact = await admin
      .from("contacts")
      .insert({
        organization_id: orgAId,
        brand_id: (brandA.data as { id: string }).id,
        first_name: "IDORTest",
        email: "idor@example.it",
        source: "manuale",
      })
      .select("id")
      .single();
    if (contact.error || !contact.data) throw new Error(`Setup contact: ${contact.error?.message}`);
    contactIdOrgA = (contact.data as { id: string }).id;
  });

  it("getContact(contactIdOrgA, orgBId) → null (IDOR bloccato)", async () => {
    const result = await getContact(contactIdOrgA, orgBId);
    expect(result).toBeNull();
  });

  it("getContact(contactIdOrgA, orgAId) → contatto (accesso legittimo)", async () => {
    const result = await getContact(contactIdOrgA, orgAId);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(contactIdOrgA);
    expect(result?.organizationId).toBe(orgAId);
  });

  it("listContacts filtrata su orgB non include contatti di orgA", async () => {
    const { items } = await listContacts({ organizationId: orgBId });
    const found = items.find((c) => c.id === contactIdOrgA);
    expect(found).toBeUndefined();
  });
});
