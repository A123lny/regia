// RS-3 RN-87 · getOrder e listOrders filtrano su organization_id (IDOR cross-tenant).

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getOrder, listOrders } from "@/modules/m01-data-hub/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("orders: tenant scoping IDOR (RS-3, RN-87)", () => {
  let orderIdOrgA: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — orders" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup org-A: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — orders" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup org-B: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-orders-${orgAId.slice(0, 8)}`,
        display_name: "Brand A",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data) throw new Error(`Setup brand: ${brandA.error?.message}`);

    const order = await admin
      .from("brand_orders")
      .insert({
        organization_id: orgAId,
        brand_id: (brandA.data as { id: string }).id,
        channel: "store",
        status: "pending",
      })
      .select("id")
      .single();
    if (order.error || !order.data) throw new Error(`Setup order: ${order.error?.message}`);
    orderIdOrgA = (order.data as { id: string }).id;
  });

  it("getOrder(orderIdOrgA, orgBId) → null (IDOR bloccato)", async () => {
    const result = await getOrder(orderIdOrgA, orgBId);
    expect(result).toBeNull();
  });

  it("getOrder(orderIdOrgA, orgAId) → ordine (legittimo)", async () => {
    const result = await getOrder(orderIdOrgA, orgAId);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(orderIdOrgA);
  });

  it("listOrders(orgBId) non include ordini di orgA", async () => {
    const { items } = await listOrders({ organizationId: orgBId });
    const found = items.find((o) => o.id === orderIdOrgA);
    expect(found).toBeUndefined();
  });
});
