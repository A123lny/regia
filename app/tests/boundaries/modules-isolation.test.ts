import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// RS-1: verifica che dependency-cruiser rilevi le violazioni di confine modulo
// e accetti il codice pulito.

describe("RS-1 · dependency-cruiser rifiuta violazioni di modulo", () => {
  it("segnala import di internal di un altro modulo", () => {
    // Genera un probe temporaneo, verifica che venga rifiutato, poi lo cancella.
    // Il file è in src/app/ (non nella cartella con parentesi) per evitare problemi
    // di shell interpretation su Windows.
    const probePath = path.join("src", "app", "probe-rs1.ts");
    fs.writeFileSync(
      probePath,
      `import type { AuditEventRow } from "../modules/m11-admin/internal/audit-query";\nexport const x: AuditEventRow | undefined = undefined;\n`,
    );
    try {
      let violated = false;
      try {
        // execFileSync with argument array: no shell interpolation, no injection risk.
        execFileSync("npx", ["depcruise", "src", "--config", ".dependency-cruiser.cjs"], {
          stdio: "pipe",
          shell: true, // npx is a shell script on Windows — shell:true required; args are hardcoded
        });
      } catch {
        violated = true;
      }
      expect(violated).toBe(true);
    } finally {
      if (fs.existsSync(probePath)) {
        fs.unlinkSync(probePath);
      }
    }
  });

  it("accetta il codice quando non ci sono violazioni", () => {
    // Deve completare senza throw. Argomenti hardcoded: nessun rischio di injection.
    expect(() =>
      execFileSync("npx", ["depcruise", "src", "--config", ".dependency-cruiser.cjs"], {
        stdio: "pipe",
        shell: true, // npx è uno script shell su Windows
      }),
    ).not.toThrow();
  });
});
