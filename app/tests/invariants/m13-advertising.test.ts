import { describe, it, expect, beforeAll } from "vitest";
import { getAdminClient } from "@/lib/db/admin";
import {
  upsertAdvertisingBudget,
  toggleAdvertisingCategory,
  listAdvertisingBudgets,
  createOverrunRequest,
  decideOverrunRequest,
  listOverrunRequests,
  getAdvertisingBudget,
} from "@/modules/m13-governance/internal/advertising-repo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = getAdminClient() as any;

describe("M13 Advertising RF-13.x", () => {
  let orgId: string;
  let brandId: string;
  const userId = null; // updated_by nullable: i test non hanno un auth.user reale

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Ads" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`org: ${org.error?.message}`);
    orgId = org.data.id;
    const brand = await admin
      .from("brands")
      .insert({ organization_id: orgId, slug: `ads-${orgId.slice(0, 6)}`, display_name: "Ads" })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`brand: ${brand.error?.message}`);
    brandId = brand.data.id;
  });

  it("RF-13.2 default: nuovo budget creato parte sempre enabled=false", async () => {
    await upsertAdvertisingBudget({
      organizationId: orgId,
      brandId,
      category: "social_sponsored",
      monthlyCapCents: 10_000,
      updatedBy: userId,
    });
    const b = await getAdvertisingBudget(orgId, brandId, "social_sponsored");
    expect(b).not.toBeNull();
    expect(b?.enabled).toBe(false);
    expect(b?.monthlyCapCents).toBe(10_000);
  });

  it("RF-13.1: upsert aggiorna solo il tetto, lascia enabled invariato", async () => {
    // Prima accendo
    await toggleAdvertisingCategory(orgId, brandId, "social_sponsored", true, userId);
    const b1 = await getAdvertisingBudget(orgId, brandId, "social_sponsored");
    expect(b1?.enabled).toBe(true);
    // Poi aggiorno il tetto: enabled resta true
    await upsertAdvertisingBudget({
      organizationId: orgId,
      brandId,
      category: "social_sponsored",
      monthlyCapCents: 50_000,
      updatedBy: userId,
    });
    const b2 = await getAdvertisingBudget(orgId, brandId, "social_sponsored");
    expect(b2?.enabled).toBe(true);
    expect(b2?.monthlyCapCents).toBe(50_000);
  });

  it("RF-13.6: createOverrunRequest richiede motivazione min 20 char + importo > tetto", async () => {
    // Motivo corto -> error
    await expect(
      createOverrunRequest({
        organizationId: orgId,
        brandId,
        category: "social_sponsored",
        requestedAmountCents: 80_000,
        motivation: "troppo poco",
        requestedBy: userId,
      }),
    ).rejects.toThrow(/motivazione/i);
    // Importo <= tetto -> error (tetto attuale 50_000)
    await expect(
      createOverrunRequest({
        organizationId: orgId,
        brandId,
        category: "social_sponsored",
        requestedAmountCents: 50_000,
        motivation: "Motivazione piu lunga dei venti caratteri richiesti dal check",
        requestedBy: userId,
      }),
    ).rejects.toThrow(/non supera il tetto/i);
    // OK
    const req = await createOverrunRequest({
      organizationId: orgId,
      brandId,
      category: "social_sponsored",
      requestedAmountCents: 100_000,
      motivation: "Serve raddoppiare il budget per cogliere la finestra Black Friday",
      requestedBy: userId,
    });
    expect(req.status).toBe("pending");
    expect(req.currentCapCents).toBe(50_000);
  });

  it("RF-13.6: decideOverrunRequest(approved) aumenta tetto automaticamente", async () => {
    const pending = await listOverrunRequests(orgId, "pending");
    expect(pending.length).toBeGreaterThan(0);
    const req = pending[0]!;
    const result = await decideOverrunRequest({
      organizationId: orgId,
      requestId: req.id,
      decision: "approved",
      decidedBy: userId,
      notes: "OK per Black Friday",
    });
    expect(result.status).toBe("approved");
    // Il tetto deve essere stato aggiornato al requested_amount
    const b = await getAdvertisingBudget(orgId, brandId, "social_sponsored");
    expect(b?.monthlyCapCents).toBe(100_000);
  });

  it("decideOverrunRequest(rejected): la richiesta cambia status ma il tetto resta invariato", async () => {
    // Crea nuova richiesta
    const req = await createOverrunRequest({
      organizationId: orgId,
      brandId,
      category: "social_sponsored",
      requestedAmountCents: 500_000,
      motivation: "Vorrei esagerare col budget perche cosi lanciamo tutto in una volta",
      requestedBy: userId,
    });
    const result = await decideOverrunRequest({
      organizationId: orgId,
      requestId: req.id,
      decision: "rejected",
      decidedBy: userId,
      notes: "Troppo alto per il mese corrente",
    });
    expect(result.status).toBe("rejected");
    const b = await getAdvertisingBudget(orgId, brandId, "social_sponsored");
    expect(b?.monthlyCapCents).toBe(100_000); // non cambiato
  });

  it("listAdvertisingBudgets ritorna budget con somme spesa (ledger) del mese", async () => {
    // Inserisco una spesa actual + una estimated nel ledger
    await admin.from("advertising_spend_ledger").insert([
      {
        organization_id: orgId,
        brand_id: brandId,
        category: "social_sponsored",
        amount_cents: 15_000,
        kind: "actual",
      },
      {
        organization_id: orgId,
        brand_id: brandId,
        category: "social_sponsored",
        amount_cents: 5_000,
        kind: "estimated",
      },
    ]);
    const budgets = await listAdvertisingBudgets(orgId);
    const b = budgets.find((x) => x.brandId === brandId && x.category === "social_sponsored");
    expect(b).toBeDefined();
    expect(b?.monthSpentCents).toBe(15_000);
    expect(b?.monthEstimatedCents).toBe(5_000);
    expect(b?.remainingCents).toBe(100_000 - 15_000 - 5_000);
  });
});
