import { describe, it, expect } from "vitest";
import { gateQuietHours } from "@/modules/m05-publishing/internal/gates";

describe("M05 gateQuietHours (RF-5.6)", () => {
  it("WA fuori fascia 09-21 ritorna sendAfter alla prossima start", async () => {
    // Nota: test dipendente dall'orario corrente. Se test gira dentro fascia, sendAfter=now.
    const orgId = "00000000-0000-0000-0000-000000000001";
    const sendAfter = await gateQuietHours(orgId, "whatsapp");
    const nowHour = new Date().getHours();
    if (nowHour < 9 || nowHour >= 21) {
      expect(sendAfter.getHours()).toBe(9);
      expect(sendAfter.getMinutes()).toBe(0);
    } else {
      expect(sendAfter.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    }
  });
  it("Email non ha quiet, ritorna now()", async () => {
    const orgId = "00000000-0000-0000-0000-000000000001";
    const sendAfter = await gateQuietHours(orgId, "email");
    expect(sendAfter.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
