"use client";

// T10: section in /governance per abilitare/disabilitare il robottino per ruolo.

import * as React from "react";
import { Bot } from "lucide-react";
import type { RobotAccessRow } from "@/modules/m14-robot-assistant/public";
import { setRobotAccessAction } from "@/modules/m14-robot-assistant/public";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  editor: "Marketing",
  delegate: "Delegato",
  agent: "Operativo",
};

export function RobotAccessSection({
  rows,
  canCrud,
}: {
  rows: RobotAccessRow[];
  canCrud: boolean;
}) {
  const [state, setState] = React.useState<RobotAccessRow[]>(rows);
  const [savingRole, setSavingRole] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleToggle(role: RobotAccessRow["role"], enabled: boolean) {
    setSavingRole(role);
    setError(null);

    // Optimistic
    setState((s) => s.map((r) => (r.role === role ? { ...r, enabled } : r)));

    const result = await setRobotAccessAction({ role, enabled });
    if (!result.ok) {
      // Rollback
      setState((s) => s.map((r) => (r.role === role ? { ...r, enabled: !enabled } : r)));
      setError(result.error);
    }
    setSavingRole(null);
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bot className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Assistente Regia (robottino)</h2>
      </div>
      <p className="text-sm text-text-muted mb-4">
        Abilita o disabilita la pallina 🤖 fluttuante per ciascun ruolo. Default: solo owner. Per
        ora espone solo tool di lettura (spiegazione pagina + consultazione contatti del brand
        selezionato). Le azioni di scrittura arriveranno con il confirm flow dedicato.
      </p>
      <div className="space-y-2">
        {state.map((row) => (
          <label
            key={row.role}
            className="flex items-center justify-between rounded-lg border border-border p-3"
          >
            <span className="text-sm font-medium">{ROLE_LABELS[row.role] ?? row.role}</span>
            <input
              type="checkbox"
              checked={row.enabled}
              disabled={!canCrud || savingRole !== null}
              onChange={(e) => handleToggle(row.role, e.target.checked)}
              className="h-5 w-10 cursor-pointer disabled:cursor-not-allowed"
              data-testid={`robot-toggle-${row.role}`}
            />
          </label>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {!canCrud && (
        <p className="mt-2 text-xs text-text-muted">
          Modifica disabilitata: richiede capability governance.crud.
        </p>
      )}
    </section>
  );
}
