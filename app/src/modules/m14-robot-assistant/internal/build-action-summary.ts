// RN-robot: genera un riassunto leggibile dell'azione pending per la UI
// di conferma. Dettagli minimi per non esporre PII nei log client.

export function buildActionSummary(toolName: string, input: unknown): string {
  const inp = (input ?? {}) as Record<string, unknown>;
  switch (toolName) {
    case "createContact": {
      const first = String(inp["firstName"] ?? "").trim();
      const last = String(inp["lastName"] ?? "").trim();
      const name = [first, last].filter(Boolean).join(" ") || "(senza nome)";
      const contact = inp["email"] || inp["phone"] || inp["whatsapp"] || "(senza recapito)";
      return `Creo un nuovo contatto: ${name} — ${contact}`;
    }
    case "updateContact": {
      const patch = (inp["patch"] ?? {}) as Record<string, unknown>;
      const changes = Object.entries(patch)
        .map(([k, v]) => `${k}=${v === null ? "(vuoto)" : JSON.stringify(v)}`)
        .join(", ");
      return `Modifico il contatto ${inp["contactId"]}. Nuovi valori: ${changes || "nessuno"}`;
    }
    case "deleteContact": {
      return `Archivio (soft-delete) il contatto ${inp["contactId"]}`;
    }
    default:
      return `Eseguo ${toolName}`;
  }
}
