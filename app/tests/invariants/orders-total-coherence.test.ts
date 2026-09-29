// RS-3 · trigger order_lines_recompute_total mantiene brand_orders.total_cents
// coerente con sum(line_total_cents). Verifica direttamente sul DB.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("RS-3 · order total coerente con somma righe", () => {
  let orgId: string;
  let brandId: string;
  let orderId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Org — order-total" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`Setup org: ${org.error?.message}`);
    orgId = (org.data as { id: string }).id;

    const brand = await admin
      .from("brands")
      .insert({
        organization_id: orgId,
        slug: `brand-total-${orgId.slice(0, 8)}`,
        display_name: "Brand total",
      })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`Setup brand: ${brand.error?.message}`);
    brandId = (brand.data as { id: string }).id;

    const order = await admin
      .from("brand_orders")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        channel: "store",
        status: "pending",
      })
      .select("id")
      .single();
    if (order.error || !order.data) throw new Error(`Setup order: ${order.error?.message}`);
    orderId = (order.data as { id: string }).id;
  });

  afterAll(async () => {
    await admin.from("organizations").delete().eq("id", orgId);
  });

  async function readTotal(): Promise<number> {
    const { data, error } = await admin
      .from("brand_orders")
      .select("total_cents")
      .eq("id", orderId)
      .single();
    if (error || !data) throw new Error("Errore lettura ordine");
    return (data as { total_cents: number }).total_cents;
  }

  it("insert 2 righe → total = somma", async () => {
    await admin.from("brand_order_lines").insert({
      order_id: orderId,
      name_snapshot: "Riga 1",
      unit_price_cents: 500,
      quantity: 2,
      line_total_cents: 0, // ricalcolato dal trigger
    });
    await admin.from("brand_order_lines").insert({
      order_id: orderId,
      name_snapshot: "Riga 2",
      unit_price_cents: 300,
      quantity: 1,
      line_total_cents: 0,
    });
    // Aspettato: 500*2 + 300*1 = 1300
    expect(await readTotal()).toBe(1300);
  });

  it("update quantity → total ricalcolato", async () => {
    const { data } = await admin
      .from("brand_order_lines")
      .select("id")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true })
      .limit(1);
    const lineId = ((data ?? []) as Array<{ id: string }>)[0]?.id;
    if (!lineId) throw new Error("Nessuna riga trovata");

    await admin.from("brand_order_lines").update({ quantity: 3 }).eq("id", lineId);
    // Aspettato: 500*3 + 300*1 = 1800
    expect(await readTotal()).toBe(1800);
  });

  it("delete riga → total decresce", async () => {
    const { data } = await admin
      .from("brand_order_lines")
      .select("id")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1);
    const lineId = ((data ?? []) as Array<{ id: string }>)[0]?.id;
    if (!lineId) throw new Error("Nessuna riga trovata");

    await admin.from("brand_order_lines").delete().eq("id", lineId);
    // Rimane: 500*3 = 1500
    expect(await readTotal()).toBe(1500);
  });
});
