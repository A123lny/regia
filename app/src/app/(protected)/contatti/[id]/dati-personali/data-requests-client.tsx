"use client";

import { useState, useTransition } from "react";
import { Download, Trash2, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createContactDataRequestAction,
  fulfillContactDataRequestAction,
  getContactDossierAction,
} from "@/modules/m01-data-hub/public";
import type { ContactDataRequestRow } from "@/modules/m01-data-hub/public";

type Props = {
  contactId: string;
  previousRequests: ContactDataRequestRow[];
  canFulfill: boolean;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(s: string): string {
  if (s === "pending") return "In sospeso";
  if (s === "fulfilled") return "Evaso";
  if (s === "rejected") return "Respinto";
  return s;
}

export function DataRequestsClient({ contactId, previousRequests, canFulfill }: Props) {
  const pending = previousRequests.find((r) => r.status === "pending");
  const closed = previousRequests.filter((r) => r.status !== "pending");

  return (
    <section className="rounded-lg border-2 border-primary/30 bg-surface p-4">
      <h2 className="font-serif text-lg font-semibold">Richieste GDPR</h2>
      <p className="mt-1 text-xs text-text-muted">
        Il cliente ha chiesto esportazione o cancellazione dei suoi dati? Registra qui la richiesta
        e, dopo averla gestita a mano, segnala l&apos;esito.
      </p>

      {pending ? (
        <PendingRequestCard request={pending} contactId={contactId} canFulfill={canFulfill} />
      ) : (
        canFulfill && <NewRequestForm contactId={contactId} />
      )}

      {closed.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-xs text-text-muted">
            Storico richieste ({closed.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {closed.map((r) => (
              <li key={r.id} className="rounded border bg-surface-muted p-2 text-xs">
                {r.requestType === "export" ? "Esportazione" : "Cancellazione"} ·{" "}
                {statusLabel(r.status)} · richiesta {formatDate(r.requestedAt)}
                {r.fulfilledAt && <> · chiusa {formatDate(r.fulfilledAt)}</>}
                {r.decisionNotes && <> · nota: {r.decisionNotes}</>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function NewRequestForm({ contactId }: { contactId: string }) {
  const [requestType, setRequestType] = useState<"export" | "erasure">("export");
  const [via, setVia] = useState("email");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createContactDataRequestAction({
        contactId,
        requestType,
        requestedVia: via,
      });
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="text-xs">
        Tipo richiesta
        <select
          value={requestType}
          onChange={(e) => setRequestType(e.target.value as "export" | "erasure")}
          disabled={pending}
          className="ml-1 rounded border p-1 text-sm"
        >
          <option value="export">Esportazione dati</option>
          <option value="erasure">Cancellazione dati</option>
        </select>
      </label>
      <label className="text-xs">
        Ricevuta via
        <select
          value={via}
          onChange={(e) => setVia(e.target.value)}
          disabled={pending}
          className="ml-1 rounded border p-1 text-sm"
        >
          <option value="email">Email</option>
          <option value="phone">Telefono</option>
          <option value="in_person">Di persona</option>
          <option value="letter">Lettera</option>
          <option value="altro">Altro</option>
        </select>
      </label>
      <Button type="button" size="sm" onClick={submit} disabled={pending}>
        Apri richiesta
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

function PendingRequestCard({
  request,
  contactId,
  canFulfill,
}: {
  request: ContactDataRequestRow;
  contactId: string;
  canFulfill: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const isErasure = request.requestType === "erasure";

  const downloadExport = () => {
    setStatus(null);
    startTransition(async () => {
      const dossier = await getContactDossierAction(contactId);
      if (!dossier) {
        setStatus("Dossier non recuperato");
        return;
      }
      // Download JSON lato client
      const blob = new Blob([JSON.stringify(dossier, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `regia-dossier-${contactId}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("Scaricato. Ora puoi consegnarlo al cliente e marcare la richiesta come evasa.");
    });
  };

  const decide = (decision: "fulfilled" | "rejected") => {
    setStatus(null);
    startTransition(async () => {
      const payload: Parameters<typeof fulfillContactDataRequestAction>[0] = {
        requestId: request.id,
        decision,
        includeSnapshot: decision === "fulfilled",
      };
      const trimmed = notes.trim();
      if (trimmed.length > 0) payload.notes = trimmed;
      const res = await fulfillContactDataRequestAction(payload);
      setStatus(res.ok ? "Richiesta aggiornata" : `Errore: ${res.error}`);
    });
  };

  return (
    <div className="mt-3 rounded-md border-2 border-amber-300 bg-amber-50 p-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-serif text-base font-bold text-amber-900">
            Richiesta aperta: {isErasure ? "Cancellazione dati" : "Esportazione dati"}
          </h3>
          <p className="mt-1 text-xs text-amber-800">
            Ricevuta via {request.requestedVia ?? "—"} · {formatDate(request.requestedAt)}
          </p>
        </div>
      </div>

      {!isErasure && (
        <div className="mt-3 rounded border border-amber-300 bg-white p-2 text-xs">
          <p>
            <strong>Procedura esportazione:</strong>
          </p>
          <ol className="ml-4 list-decimal text-text-muted">
            <li>Scarica il JSON del dossier con il bottone sotto.</li>
            <li>
              Chiedi al team interno (gestionali Lenny/Stazione) i dati che non vivono qui
              (scontrini bar, preventivi, storico acquisti).
            </li>
            <li>Consegna tutto al cliente via canale tracciato.</li>
            <li>Torna qui e marca la richiesta come evasa.</li>
          </ol>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={downloadExport}
            disabled={pending}
            className="mt-2"
          >
            <Download className="mr-1 h-3 w-3" /> Scarica dossier JSON
          </Button>
        </div>
      )}

      {isErasure && (
        <div className="mt-3 rounded border border-danger/50 bg-red-50 p-2 text-xs">
          <p>
            <strong>Procedura cancellazione:</strong>
          </p>
          <ol className="ml-4 list-decimal text-text-muted">
            <li>Verifica l&apos;identita del richiedente (RF-1.9 vincolo manuale).</li>
            <li>Chiedi anche al team interno di procedere con la cancellazione nei gestionali.</li>
            <li>
              Marca come evasa: nome/cognome/email/telefono/whatsapp verranno nullificati e il
              contatto archiviato. I dati storici (ordini, voucher gia&apos; usati, publish log)
              RESTANO per audit — solo l&apos;ancora identificativa viene svuotata.
            </li>
            <li>
              La cancellazione sui dati storici lato gestionale e&apos; manuale e non reversibile da
              qui.
            </li>
          </ol>
        </div>
      )}

      {canFulfill && (
        <div className="mt-3 space-y-2">
          <Input
            type="text"
            placeholder="Note sulla decisione (opzionale)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => decide("rejected")}
              disabled={pending}
            >
              Respingi
            </Button>
            <Button type="button" size="sm" onClick={() => decide("fulfilled")} disabled={pending}>
              {isErasure ? (
                <>
                  <Trash2 className="mr-1 h-3 w-3" /> Marca evasa (archivia contatto)
                </>
              ) : (
                <>
                  <FileCheck className="mr-1 h-3 w-3" /> Marca evasa
                </>
              )}
            </Button>
          </div>
          {status && <p className="text-xs">{status}</p>}
        </div>
      )}
    </div>
  );
}
