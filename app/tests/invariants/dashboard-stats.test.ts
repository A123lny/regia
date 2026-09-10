import { describe, expect, it } from "vitest";
import { getDashboardStats } from "@/modules/m12-daily-use/public";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const FAKE_ORG_ID = "00000000-0000-0000-0000-000000000099";

describe("M12 · getDashboardStats", () => {
  it("returns 4 brands from seed for the real org", async () => {
    const stats = await getDashboardStats(ORG_ID);
    expect(stats.going.brands.length).toBe(4);
    const slugs = stats.going.brands.map((b) => b.slug).sort();
    expect(slugs).toEqual(["eni-cafe", "lenny", "officina", "stazione"]);
  });

  it("returns 0 for future-table counters without throwing", async () => {
    const stats = await getDashboardStats(ORG_ID);
    expect(stats.toDo.contentsPending).toBe(0);
    expect(stats.toDo.reviewsPending).toBe(0);
    expect(stats.toDo.restaurantsCooling).toBe(0);
    expect(stats.toDo.costAlerts).toBe(0);
  });

  it("respects organization scoping (fake org returns 0 brands)", async () => {
    const stats = await getDashboardStats(FAKE_ORG_ID);
    expect(stats.going.brands.length).toBe(0);
  });

  it("reports environment as sviluppo-locale by default", async () => {
    const stats = await getDashboardStats(ORG_ID);
    expect(stats.going.environment).toBe("sviluppo-locale");
  });
});
