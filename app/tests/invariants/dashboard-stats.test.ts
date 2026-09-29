import { describe, expect, it } from "vitest";
import { getDashboardStats } from "@/modules/m12-daily-use/public";

const ORG_ID = "00000000-0000-0000-0000-000000000001";
const FAKE_ORG_ID = "00000000-0000-0000-0000-000000000099";

describe("M12 · getDashboardStats", () => {
  it("returns the 4 seed brands (plus any user-created active brand)", async () => {
    const stats = await getDashboardStats(ORG_ID);
    const slugs = stats.going.brands.map((b) => b.slug);
    // I 4 seed devono essere presenti; il DB dev puo contenere brand aggiuntivi
    // creati via UI/script durante lo sviluppo.
    for (const seed of ["eni-cafe", "lenny", "officina", "stazione"]) {
      expect(slugs, `brand seed "${seed}" mancante`).toContain(seed);
    }
    expect(stats.going.brands.length).toBeGreaterThanOrEqual(4);
  });

  it("returns numeric counters for content pipeline stages", async () => {
    const stats = await getDashboardStats(ORG_ID);
    expect(stats.toDo.draftsPending).toBeGreaterThanOrEqual(0);
    expect(stats.toDo.approvedNotScheduled).toBeGreaterThanOrEqual(0);
    expect(stats.toDo.scheduledUpcoming).toBeGreaterThanOrEqual(0);
    expect(stats.toDo.publishedThisWeek).toBeGreaterThanOrEqual(0);
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
