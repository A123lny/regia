import { getSessionOrRedirect } from "@/lib/auth/session";
import { getRecentAuditEvents } from "@/modules/m11-admin/public";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ActorKind = "user" | "agent" | "system";

const ACTOR_LABELS: Record<ActorKind, string> = {
  user: "utente",
  agent: "agente",
  system: "sistema",
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string }>;
}) {
  const session = await getSessionOrRedirect();
  const params = await searchParams;
  const actorFilter = params.actor;

  const events = await getRecentAuditEvents(session.organizationId, 50);
  const filtered =
    actorFilter && ["user", "agent", "system"].includes(actorFilter)
      ? events.filter((e) => e.actor_kind === actorFilter)
      : events;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-text">Audit log</h1>
        <p className="mt-1 text-sm text-text-muted">
          Traccia di ogni azione umana e agente (RF-11.3). Append-only garantito in DB.
        </p>
      </header>

      <div className="flex items-center gap-3">
        <form className="flex items-center gap-2">
          <label htmlFor="actor" className="text-sm text-text-muted">
            Filtro attore:
          </label>
          <select
            id="actor"
            name="actor"
            defaultValue={actorFilter ?? ""}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
          >
            <option value="">Tutti</option>
            <option value="user">Utenti</option>
            <option value="agent">Agenti</option>
            <option value="system">Sistema</option>
          </select>
          <button
            type="submit"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-hover"
          >
            Applica
          </button>
        </form>
        <span className="text-xs text-text-muted">
          {filtered.length} di {events.length} eventi (ultimi 50)
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Attore</TableHead>
              <TableHead>Azione</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Dettagli</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-text-muted">
                  Nessun evento nel log per il filtro corrente.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs text-text-muted">
                    {formatTimestamp(e.created_at)}
                  </TableCell>
                  <TableCell>
                    <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs">
                      {ACTOR_LABELS[e.actor_kind]}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.action}</TableCell>
                  <TableCell className="text-text-muted">{e.target ?? "—"}</TableCell>
                  <TableCell>
                    {Object.keys(e.details).length === 0 ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      <details>
                        <summary className="cursor-pointer text-xs text-primary hover:underline">
                          Espandi
                        </summary>
                        <pre className="mt-2 max-w-xs overflow-x-auto rounded bg-surface-muted p-2 text-xs">
                          {JSON.stringify(e.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
