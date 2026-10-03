"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, UserCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandChip } from "@/components/brand/brand-chip";
import {
  upsertRiderCapacityWindowAction,
  updateRiderCapacityFilledAction,
  deleteRiderCapacityWindowAction,
  createRiderShiftRequestAction,
  fulfillRiderShiftRequestAction,
  cancelRiderShiftRequestAction,
  WEEKDAY_LABELS,
} from "@/modules/m13-governance/public";
import type {
  RiderCapacityWindowRow,
  RiderShiftRequestRow,
  Weekday,
} from "@/modules/m13-governance/public";

type BrandOpt = { id: string; slug: string; displayName: string; color: string };

type Props = {
  brands: BrandOpt[];
  windows: RiderCapacityWindowRow[];
  shiftRequests: RiderShiftRequestRow[];
  canManage: boolean;
  canRequest: boolean;
  canFulfill: boolean;
};

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0]; // lun→dom (iso)

export function RiderCapacityClient({
  brands,
  windows,
  shiftRequests,
  canManage,
  canRequest,
  canFulfill,
}: Props) {
  return (
    <div className="space-y-6">
      {shiftRequests.length > 0 && (
        <ShiftRequestsSection requests={shiftRequests} canFulfill={canFulfill} />
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-serif text-lg font-semibold">Finestre settimanali</h2>
            <p className="text-xs text-text-muted">
              Capacita rider per giorno/orario (ricorrente). Default: nessuna finestra = nessuna
              promo food consentita in quella fascia.
            </p>
          </div>
          {canRequest && brands.length > 0 && <NewShiftRequestForm brands={brands} />}
        </div>

        {brands.map((b) => (
          <BrandWindowsCard
            key={b.id}
            brand={b}
            windows={windows.filter((w) => w.brandId === b.id)}
            canManage={canManage}
          />
        ))}
      </section>
    </div>
  );
}

function BrandWindowsCard({
  brand,
  windows,
  canManage,
}: {
  brand: BrandOpt;
  windows: RiderCapacityWindowRow[];
  canManage: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [weekday, setWeekday] = useState<Weekday>(5);
  const [timeStart, setTimeStart] = useState("19:00");
  const [timeEnd, setTimeEnd] = useState("21:00");
  const [slotsTotal, setSlotsTotal] = useState("3");
  const [error, setError] = useState<string | null>(null);

  const addWindow = () => {
    const total = Number(slotsTotal);
    if (!Number.isFinite(total) || total < 0) {
      setError("slots_total non valido");
      return;
    }
    if (timeEnd <= timeStart) {
      setError("time_end deve essere > time_start");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await upsertRiderCapacityWindowAction({
        brandId: brand.id,
        weekday,
        timeStart,
        timeEnd,
        slotsTotal: Math.round(total),
      });
      if (res.ok) setAdding(false);
      else setError(res.error);
    });
  };

  return (
    <div className="rounded-lg border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border p-3">
        <BrandChip slug={brand.slug} name={brand.displayName} color={brand.color} />
        {canManage && (
          <Button type="button" size="sm" variant="outline" onClick={() => setAdding(!adding)}>
            <Plus className="mr-1 h-3 w-3" /> Nuova finestra
          </Button>
        )}
      </header>
      {adding && (
        <div className="space-y-2 border-b border-border bg-surface-muted p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              Giorno
              <select
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value) as Weekday)}
                disabled={pending}
                className="ml-1 rounded border p-1 text-sm"
              >
                {WEEKDAYS.map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAY_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Dalle
              <Input
                type="time"
                value={timeStart}
                onChange={(e) => setTimeStart(e.target.value)}
                className="w-24"
                disabled={pending}
              />
            </label>
            <label className="text-xs">
              Alle
              <Input
                type="time"
                value={timeEnd}
                onChange={(e) => setTimeEnd(e.target.value)}
                className="w-24"
                disabled={pending}
              />
            </label>
            <label className="text-xs">
              Slot rider
              <Input
                type="number"
                value={slotsTotal}
                onChange={(e) => setSlotsTotal(e.target.value)}
                className="w-20"
                disabled={pending}
                min={0}
              />
            </label>
            <Button type="button" size="sm" onClick={addWindow} disabled={pending}>
              Aggiungi
            </Button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
      {windows.length === 0 ? (
        <p className="p-4 text-xs italic text-text-muted">
          Nessuna finestra configurata. Nessuna promo food consentita per questo marchio finche non
          e&apos; definita almeno una fascia.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
            <tr>
              <th className="p-2">Giorno</th>
              <th className="p-2">Orario</th>
              <th className="p-2">Slot</th>
              <th className="p-2">Riempiti</th>
              <th className="p-2">Stato</th>
              <th className="p-2 text-right">Azioni</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w) => (
              <WindowRow key={w.id} window={w} canManage={canManage} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function WindowRow({
  window: w,
  canManage,
}: {
  window: RiderCapacityWindowRow;
  canManage: boolean;
}) {
  const [filled, setFilled] = useState(String(w.slotsFilled));
  const [pending, startTransition] = useTransition();

  const save = () => {
    const n = Number(filled);
    if (!Number.isFinite(n) || n < 0) return;
    startTransition(async () => {
      await updateRiderCapacityFilledAction({ windowId: w.id, slotsFilled: Math.round(n) });
    });
  };

  const remove = () => {
    if (!confirm("Eliminare questa finestra?")) return;
    startTransition(async () => {
      await deleteRiderCapacityWindowAction(w.id);
    });
  };

  const pct = Math.round(w.fillRatio * 100);

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="p-2 text-sm">{WEEKDAY_LABELS[w.weekday]}</td>
      <td className="p-2 text-xs text-text-muted">
        {w.timeStart.slice(0, 5)} – {w.timeEnd.slice(0, 5)}
      </td>
      <td className="p-2 text-sm font-medium">{w.slotsTotal}</td>
      <td className="p-2 text-sm">
        {canManage ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              value={filled}
              onChange={(e) => setFilled(e.target.value)}
              className="w-16 text-xs"
              disabled={pending}
              min={0}
            />
            <Button type="button" size="sm" variant="ghost" onClick={save} disabled={pending}>
              OK
            </Button>
          </div>
        ) : (
          <span>{w.slotsFilled}</span>
        )}
      </td>
      <td className="p-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
            w.isSaturated
              ? "bg-danger/15 text-danger"
              : pct >= 70
                ? "bg-amber-100 text-amber-800"
                : "bg-success/15 text-success"
          }`}
        >
          {w.isSaturated && <AlertCircle className="h-3 w-3" />}
          {pct}% pieno
        </span>
      </td>
      <td className="p-2 text-right">
        {canManage && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="rounded p-1 text-text-muted hover:bg-danger/10 hover:text-danger"
            aria-label="Elimina"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </td>
    </tr>
  );
}

function ShiftRequestsSection({
  requests,
  canFulfill,
}: {
  requests: RiderShiftRequestRow[];
  canFulfill: boolean;
}) {
  return (
    <section className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
      <div className="mb-3 flex items-start gap-2">
        <UserCheck className="mt-0.5 h-5 w-5 text-amber-700" />
        <div>
          <h2 className="font-serif text-lg font-semibold text-amber-900">
            Richieste disponibilita rider ({requests.length})
          </h2>
          <p className="mt-1 text-xs text-amber-800">
            RN-43 · Richieste quantificate con slot residui da coprire.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {requests.map((r) => (
          <ShiftRequestCard key={r.id} request={r} canFulfill={canFulfill} />
        ))}
      </div>
    </section>
  );
}

function ShiftRequestCard({
  request,
  canFulfill,
}: {
  request: RiderShiftRequestRow;
  canFulfill: boolean;
}) {
  const [filled, setFilled] = useState(String(request.slotsFilled));
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const save = () => {
    const n = Number(filled);
    if (!Number.isFinite(n) || n < 0) return;
    setStatus(null);
    startTransition(async () => {
      const res = await fulfillRiderShiftRequestAction({
        requestId: request.id,
        slotsFilled: Math.round(n),
      });
      setStatus(res.ok ? "Aggiornato" : `Errore: ${res.error}`);
    });
  };

  const cancel = () => {
    if (!confirm("Annullare la richiesta?")) return;
    setStatus(null);
    startTransition(async () => {
      const res = await cancelRiderShiftRequestAction(request.id);
      setStatus(res.ok ? "Annullata" : `Errore: ${res.error}`);
    });
  };

  const residui = request.slotsNeeded - request.slotsFilled;

  return (
    <div className="rounded-md border border-amber-300 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <BrandChip
          slug={request.brandSlug}
          name={request.brandDisplayName}
          color={request.brandColor}
        />
        <span className="text-xs text-text-muted">
          {request.shiftDate} · {request.timeStart.slice(0, 5)} – {request.timeEnd.slice(0, 5)}
        </span>
        <span className="ml-auto text-xs">
          <strong>{request.slotsFilled}</strong>/{request.slotsNeeded} slot
          {residui > 0 && (
            <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
              -{residui}
            </span>
          )}
        </span>
      </div>
      {request.note && <p className="mt-1 text-xs text-text-muted">{request.note}</p>}
      {canFulfill && (
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            value={filled}
            onChange={(e) => setFilled(e.target.value)}
            className="w-20"
            min={0}
            max={request.slotsNeeded}
            disabled={pending}
          />
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            Aggiorna
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={cancel} disabled={pending}>
            Annulla
          </Button>
          {status && <span className="text-xs">{status}</span>}
        </div>
      )}
    </div>
  );
}

function NewShiftRequestForm({ brands }: { brands: BrandOpt[] }) {
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [shiftDate, setShiftDate] = useState("");
  const [timeStart, setTimeStart] = useState("19:00");
  const [timeEnd, setTimeEnd] = useState("21:00");
  const [slotsNeeded, setSlotsNeeded] = useState("3");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    const n = Number(slotsNeeded);
    if (!Number.isFinite(n) || n <= 0) {
      setError("slots_needed > 0");
      return;
    }
    if (!shiftDate) {
      setError("Data obbligatoria");
      return;
    }
    setError(null);
    startTransition(async () => {
      const payload: Parameters<typeof createRiderShiftRequestAction>[0] = {
        brandId,
        shiftDate,
        timeStart,
        timeEnd,
        slotsNeeded: Math.round(n),
      };
      if (note.trim()) payload.note = note.trim();
      const res = await createRiderShiftRequestAction(payload);
      if (res.ok) {
        setOpen(false);
        setShiftDate("");
        setNote("");
      } else {
        setError(res.error);
      }
    });
  };

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        className="bg-primary text-white"
      >
        <Plus className="mr-1 h-3 w-3" /> Nuova richiesta rider
      </Button>
    );
  }

  return (
    <div className="w-full rounded-lg border-2 border-primary/40 bg-surface p-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <label className="text-xs">
          Marchio
          <select
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            disabled={pending}
            className="w-full rounded border p-1 text-sm"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          Data
          <Input
            type="date"
            value={shiftDate}
            onChange={(e) => setShiftDate(e.target.value)}
            disabled={pending}
          />
        </label>
        <label className="text-xs">
          Dalle
          <Input
            type="time"
            value={timeStart}
            onChange={(e) => setTimeStart(e.target.value)}
            disabled={pending}
          />
        </label>
        <label className="text-xs">
          Alle
          <Input
            type="time"
            value={timeEnd}
            onChange={(e) => setTimeEnd(e.target.value)}
            disabled={pending}
          />
        </label>
        <label className="text-xs">
          Slot
          <Input
            type="number"
            value={slotsNeeded}
            onChange={(e) => setSlotsNeeded(e.target.value)}
            min={1}
            disabled={pending}
          />
        </label>
      </div>
      <Input
        type="text"
        placeholder="Nota (opzionale)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="mt-2"
        disabled={pending}
      />
      <div className="mt-2 flex items-center gap-2">
        <Button type="button" size="sm" onClick={create} disabled={pending}>
          Crea
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Annulla
        </Button>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    </div>
  );
}
