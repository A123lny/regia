import { describe, it, expect, beforeAll } from "vitest";
import { getAdminClient } from "@/lib/db/admin";
import {
  upsertRiderCapacityWindow,
  checkRiderCapacityForSlot,
  assertRiderCapacityOk,
  RiderCapacityExceededError,
  createRiderShiftRequest,
  updateShiftRequestFilled,
  cancelShiftRequest,
  listRiderShiftRequests,
} from "@/modules/m13-governance/internal/rider-capacity-repo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = getAdminClient() as any;

describe("M13 Rider capacity (RF-6.18 + RN-41..43)", () => {
  let orgId: string;
  let brandId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test Lenny capacita" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`org: ${org.error?.message}`);
    orgId = org.data.id;
    const brand = await admin
      .from("brands")
      .insert({ organization_id: orgId, slug: `riders-${orgId.slice(0, 6)}`, display_name: "L" })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`brand: ${brand.error?.message}`);
    brandId = brand.data.id;
  });

  it("checkRiderCapacityForSlot ritorna no_window_configured se finestra non esiste (default conservativo)", async () => {
    const check = await checkRiderCapacityForSlot(orgId, brandId, 5, "19:30");
    expect(check.ok).toBe(false);
    if (!check.ok) {
      expect(check.reason).toBe("no_window_configured");
    }
  });

  it("checkRiderCapacityForSlot ritorna zero_capacity se finestra con slots_total=0", async () => {
    await upsertRiderCapacityWindow({
      organizationId: orgId,
      brandId,
      weekday: 1, // lunedi
      timeStart: "19:00",
      timeEnd: "21:00",
      slotsTotal: 0,
    });
    const check = await checkRiderCapacityForSlot(orgId, brandId, 1, "19:30");
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("zero_capacity");
  });

  it("checkRiderCapacityForSlot ritorna ok=true se slot residui >= 10%", async () => {
    await upsertRiderCapacityWindow({
      organizationId: orgId,
      brandId,
      weekday: 2, // martedi
      timeStart: "19:00",
      timeEnd: "21:00",
      slotsTotal: 10,
      slotsFilled: 7, // 70% pieno, 30% residuo
    });
    const check = await checkRiderCapacityForSlot(orgId, brandId, 2, "19:30");
    expect(check.ok).toBe(true);
    if (check.ok) {
      expect(check.fillRatio).toBeCloseTo(0.7);
    }
  });

  it("checkRiderCapacityForSlot ritorna saturated se residuo < 10%", async () => {
    await upsertRiderCapacityWindow({
      organizationId: orgId,
      brandId,
      weekday: 3, // mercoledi
      timeStart: "19:00",
      timeEnd: "21:00",
      slotsTotal: 10,
      slotsFilled: 10, // 100% pieno
    });
    const check = await checkRiderCapacityForSlot(orgId, brandId, 3, "19:30");
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe("saturated");
  });

  it("assertRiderCapacityOk throw RiderCapacityExceededError se saturato (RF-6.18)", async () => {
    await expect(assertRiderCapacityOk(orgId, brandId, 3, "19:30")).rejects.toThrow(
      RiderCapacityExceededError,
    );
  });

  it("Shift request: creazione pending, update slots_filled transiziona partially_filled→filled", async () => {
    const req = await createRiderShiftRequest({
      organizationId: orgId,
      brandId,
      shiftDate: "2026-10-10",
      timeStart: "19:00",
      timeEnd: "21:00",
      slotsNeeded: 3,
      createdBy: null,
    });
    expect(req.status).toBe("pending");

    const updated1 = await updateShiftRequestFilled(orgId, req.id, 1);
    expect(updated1?.status).toBe("partially_filled");

    const updated2 = await updateShiftRequestFilled(orgId, req.id, 3);
    expect(updated2?.status).toBe("filled");

    const list = await listRiderShiftRequests(orgId, { onlyActive: true });
    expect(list.find((r) => r.id === req.id)).toBeUndefined(); // filled non e' active
  });

  it("cancelShiftRequest transiziona a cancelled e lo esclude dagli active", async () => {
    const req = await createRiderShiftRequest({
      organizationId: orgId,
      brandId,
      shiftDate: "2026-10-11",
      timeStart: "12:00",
      timeEnd: "14:00",
      slotsNeeded: 2,
      createdBy: null,
    });
    const cancelled = await cancelShiftRequest(orgId, req.id);
    expect(cancelled?.status).toBe("cancelled");
    const active = await listRiderShiftRequests(orgId, { onlyActive: true });
    expect(active.find((r) => r.id === req.id)).toBeUndefined();
  });

  it("UNIQUE (org, brand, weekday, time_start): upsert idempotente non duplica", async () => {
    await upsertRiderCapacityWindow({
      organizationId: orgId,
      brandId,
      weekday: 4,
      timeStart: "12:00",
      timeEnd: "14:00",
      slotsTotal: 5,
    });
    await upsertRiderCapacityWindow({
      organizationId: orgId,
      brandId,
      weekday: 4,
      timeStart: "12:00",
      timeEnd: "14:00",
      slotsTotal: 8, // aggiorno
    });
    const { data } = await admin
      .from("rider_capacity_windows")
      .select("slots_total")
      .eq("organization_id", orgId)
      .eq("brand_id", brandId)
      .eq("weekday", 4)
      .eq("time_start", "12:00:00");
    expect(data).toHaveLength(1);
    expect(data[0].slots_total).toBe(8);
  });
});
