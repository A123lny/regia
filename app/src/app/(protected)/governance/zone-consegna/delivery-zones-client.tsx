"use client";

import { useState, useTransition } from "react";
import { Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { BrandChip } from "@/components/brand/brand-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  upsertDeliveryZoneAction,
  deleteDeliveryZoneAction,
  openBlackoutAction,
  closeBlackoutAction,
} from "@/modules/m13-governance/public";
import type { DeliveryZoneRow, DeliveryBlackoutKind } from "@/modules/m13-governance/public";

type BrandOpt = { id: string; slug: string; displayName: string; color: string };

type Props = {
  zones: DeliveryZoneRow[];
  brands: BrandOpt[];
  blackoutKinds: DeliveryBlackoutKind[];
  blackoutLabels: Record<DeliveryBlackoutKind, string>;
  canManage: boolean;
  canToggleBlackout: boolean;
};

export function DeliveryZonesClient({
  zones,
  brands,
  blackoutKinds,
  blackoutLabels,
  canManage,
  canToggleBlackout,
}: Props) {
  const [creatingBrandId, setCreatingBrandId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface">
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-serif text-lg font-semibold">Zone configurate</h2>
          {canManage && brands.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={creatingBrandId ?? ""}
                onChange={(e) => setCreatingBrandId(e.target.value || null)}
                className="rounded border p-1 text-sm"
              >
                <option value="">— Nuova zona per marchio —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </header>

        {creatingBrandId && canManage && (
          <div className="border-b border-border bg-surface-muted p-4">
            <NewZoneForm brandId={creatingBrandId} onDone={() => setCreatingBrandId(null)} />
          </div>
        )}

        {zones.length === 0 ? (
          <p className="p-6 text-sm italic text-text-muted">
            Nessuna zona configurata. Aggiungi una zona per il brand che fa delivery (es. Lenny) con
            i prefissi CAP serviti.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="p-3">Marchio</th>
                <th className="p-3">Zona</th>
                <th className="p-3">Prefissi CAP</th>
                <th className="p-3">Stato</th>
                <th className="w-32 p-3" />
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <ZoneRow
                  key={z.id}
                  zone={z}
                  blackoutKinds={blackoutKinds}
                  blackoutLabels={blackoutLabels}
                  canManage={canManage}
                  canToggleBlackout={canToggleBlackout}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function NewZoneForm({ brandId, onDone }: { brandId: string; onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capList, setCapList] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    const prefixes = capList
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    startTransition(async () => {
      const res = await upsertDeliveryZoneAction({
        brandId,
        name,
        description: description || null,
        capPrefixes: prefixes,
      });
      if (!res.ok) setError(res.error);
      else onDone();
    });
  };

  return (
    <div className="space-y-2">
      <h3 className="font-semibold">Nuova zona</h3>
      <Input
        placeholder="Nome zona (es. Centro, Castelli alti)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
      />
      <Input
        placeholder="Descrizione opzionale"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={pending}
      />
      <Input
        placeholder="Prefissi CAP (separati da virgola o spazio, es. 47890 47891)"
        value={capList}
        onChange={(e) => setCapList(e.target.value)}
        disabled={pending}
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={submit} disabled={pending || !name}>
          Crea
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone} disabled={pending}>
          Annulla
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function ZoneRow({
  zone,
  blackoutKinds,
  blackoutLabels,
  canManage,
  canToggleBlackout,
}: {
  zone: DeliveryZoneRow;
  blackoutKinds: DeliveryBlackoutKind[];
  blackoutLabels: Record<DeliveryBlackoutKind, string>;
  canManage: boolean;
  canToggleBlackout: boolean;
}) {
  const [showBlackoutForm, setShowBlackoutForm] = useState(false);
  const [kind, setKind] = useState<DeliveryBlackoutKind>("rain");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const openBo = () => {
    setError(null);
    startTransition(async () => {
      const payload: Parameters<typeof openBlackoutAction>[0] = {
        zoneId: zone.id,
        kind,
      };
      if (reason.trim().length > 0) payload.reason = reason.trim();
      const res = await openBlackoutAction(payload);
      if (!res.ok) setError(res.error);
      else {
        setShowBlackoutForm(false);
        setReason("");
      }
    });
  };

  const closeBo = () => {
    if (!zone.activeBlackout) return;
    const bId = zone.activeBlackout.id;
    setError(null);
    startTransition(async () => {
      const res = await closeBlackoutAction(bId);
      if (!res.ok) setError(res.error);
    });
  };

  const deleteZ = () => {
    if (!confirm(`Eliminare zona "${zone.name}"?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteDeliveryZoneAction(zone.id);
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <>
      <tr className="border-b border-border/60">
        <td className="p-3">
          <BrandChip slug={zone.brandSlug} name={zone.brandDisplayName} color={zone.brandColor} />
        </td>
        <td className="p-3">
          <strong>{zone.name}</strong>
          {zone.description && <div className="text-xs text-text-muted">{zone.description}</div>}
        </td>
        <td className="p-3 text-xs">
          {zone.capPrefixes.length > 0 ? zone.capPrefixes.join(", ") : "—"}
        </td>
        <td className="p-3">
          {zone.activeBlackout ? (
            <div className="flex items-start gap-1 text-xs">
              <AlertTriangle className="mt-0.5 h-3 w-3 text-danger" />
              <div>
                <strong className="text-danger">{blackoutLabels[zone.activeBlackout.kind]}</strong>
                {zone.activeBlackout.reason && (
                  <div className="text-text-muted">{zone.activeBlackout.reason}</div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-success">
              <CheckCircle2 className="h-3 w-3" /> Servita
            </div>
          )}
        </td>
        <td className="p-3">
          <div className="flex gap-1">
            {zone.activeBlackout
              ? canToggleBlackout && (
                  <Button type="button" size="sm" onClick={closeBo} disabled={pending}>
                    Riapri
                  </Button>
                )
              : canToggleBlackout && (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowBlackoutForm(!showBlackoutForm)}
                    disabled={pending}
                  >
                    Blackout
                  </Button>
                )}
            {canManage && (
              <button
                type="button"
                onClick={deleteZ}
                disabled={pending}
                className="rounded-md p-1 text-text-muted hover:bg-danger/10 hover:text-danger"
                aria-label="Elimina zona"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </td>
      </tr>
      {showBlackoutForm && !zone.activeBlackout && (
        <tr className="bg-amber-50">
          <td colSpan={5} className="p-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs">
                Motivo
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as DeliveryBlackoutKind)}
                  disabled={pending}
                  className="ml-1 rounded border p-1 text-sm"
                >
                  {blackoutKinds.map((k) => (
                    <option key={k} value={k}>
                      {blackoutLabels[k]}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                placeholder="Note aggiuntive (opzionali)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={pending}
                className="flex-1 min-w-[200px]"
              />
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={openBo}
                disabled={pending}
              >
                Apri blackout
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowBlackoutForm(false)}
                disabled={pending}
              >
                Annulla
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
