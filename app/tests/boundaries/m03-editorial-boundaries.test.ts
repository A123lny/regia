import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

describe("m03-editorial: boundaries dep-cruiser (RS-1, RS-2)", () => {
  it("dep-cruiser esce 0 su modulo m03-editorial", () => {
    // Esegue dep-cruiser scoped sul modulo m03 e verifica 0 violations.
    // Il comando gira dalla root dell'app (cwd del processo test).
    let output: string;
    let exitCode = 0;
    try {
      // execSync con stringa letterale hardcoded: nessun input utente interpolato,
      // nessun rischio di command injection. Pattern identico a modules-isolation.test.ts.
      output = execSync(
        "npx dependency-cruiser --config .dependency-cruiser.cjs src/modules/m03-editorial src/lib/ai --no-progress 2>&1",
        { encoding: "utf-8", cwd: process.cwd() },
      );
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      output = String(e?.stdout ?? "") + String(e?.stderr ?? "");
      exitCode = e?.status ?? 1;
    }

    expect(exitCode, `dep-cruiser output:\n${output}`).toBe(0);
    expect(output).not.toMatch(/error\s+cross-module-internal-forbidden/i);
    expect(output).not.toMatch(/error\s+modules-internal-forbidden/i);
    expect(output).not.toMatch(/error\s+no-circular/i);
  });
});
