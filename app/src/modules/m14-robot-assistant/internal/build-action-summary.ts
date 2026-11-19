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
    case "createTask": {
      const title = String(inp["title"] ?? "(senza titolo)");
      const due = inp["dueAt"] ? new Date(String(inp["dueAt"])).toLocaleString("it-IT") : null;
      const priority = String(inp["priority"] ?? "important");
      return `Creo il task "${title}"${due ? ` per ${due}` : ""} (priorità: ${priority})`;
    }
    case "generateContentDraft": {
      const theme = String(inp["themeInput"] ?? "(senza tema)");
      const excerpt = theme.length > 80 ? theme.slice(0, 80) + "..." : theme;
      return `Genero bozza di contenuto: "${excerpt}" (costo budget AI motore editoriale)`;
    }
    case "approveContentDraft":
      return `Approvo la bozza ${inp["draftId"]}`;
    case "rejectContentDraft":
      return `Rifiuto la bozza ${inp["draftId"]}: ${String(inp["reason"] ?? "").slice(0, 100)}`;
    case "scheduleContentDraft": {
      const sched = inp["scheduledAt"] ? String(inp["scheduledAt"]) : "(senza data)";
      return `Schedulo la bozza ${inp["draftId"]} per ${sched}`;
    }
    case "deleteContentDraft":
      return `Elimino la bozza ${inp["draftId"]}`;
    case "completeTask":
      return `Segno come fatto il task ${inp["taskId"]}`;
    case "reopenTask":
      return `Riapro il task ${inp["taskId"]}`;
    case "cancelTask":
      return `Cancello il task ${inp["taskId"]}`;
    case "updateTask": {
      const patch = (inp["patch"] ?? {}) as Record<string, unknown>;
      const changes = Object.entries(patch)
        .map(([k, v]) => `${k}=${v === null ? "(vuoto)" : JSON.stringify(v)}`)
        .join(", ");
      return `Modifico il task ${inp["taskId"]}: ${changes || "nessuna modifica"}`;
    }
    case "createPartner": {
      const name = String(inp["name"] ?? "(senza nome)");
      const cuisine = inp["cuisineCategory"] ? ` (${inp["cuisineCategory"]})` : "";
      return `Creo il fornitore "${name}"${cuisine}`;
    }
    case "archivePartner":
      return `Archivio il fornitore ${inp["partnerId"]}`;
    case "logPartnerActivity": {
      const kind = String(inp["kind"] ?? "note");
      const outcome = inp["outcome"] ? ` (${inp["outcome"]})` : "";
      return `Registro attività '${kind}'${outcome} con fornitore ${inp["partnerId"]}`;
    }
    case "dismissReminder":
      return `Chiudo il promemoria ${inp["reminderId"]} (senza inviare)`;
    case "markReminderSent":
      return `Marco il promemoria ${inp["reminderId"]} come già inviato manualmente`;
    case "sendReminderNow":
      return `Invio SUBITO il promemoria ${inp["reminderId"]} via SMS/email/WhatsApp`;
    case "issueVoucher": {
      return `Emetto un voucher (offerId ${inp["offerId"]}) per il contatto ${inp["contactId"]}`;
    }
    case "createBrand": {
      const name = String(inp["displayName"] ?? "(senza nome)");
      const slug = String(inp["slug"] ?? "?");
      return `Creo il brand "${name}" (slug: ${slug}, colore: ${inp["color"]})`;
    }
    case "updateBrand": {
      const patch = (inp["patch"] ?? {}) as Record<string, unknown>;
      const changes = Object.entries(patch)
        .map(([k, v]) => `${k}=${v === null ? "(vuoto)" : JSON.stringify(v)}`)
        .join(", ");
      return `Modifico il brand ${inp["brandId"]}: ${changes || "nessuna modifica"}`;
    }
    case "archiveBrand":
      return `Archivio il brand ${inp["brandId"]}`;
    case "restoreBrand":
      return `Ripristino il brand ${inp["brandId"]}`;
    case "createOffer": {
      const name = String(inp["name"] ?? "(senza nome)");
      const kind = String(inp["rewardKind"] ?? "?");
      return `Creo offer "${name}" (reward: ${kind})`;
    }
    default:
      return `Eseguo ${toolName}`;
  }
}
