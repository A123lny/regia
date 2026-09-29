"use client";

import { useState } from "react";
import Link from "next/link";
import { UserCircle2, Truck } from "lucide-react";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ORDER_CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  formatCents,
} from "@/modules/m01-data-hub/public";
import type { OrderRow, OrderLine, OrderStatus } from "@/modules/m01-data-hub/public";

type Props = { orders: OrderRow[] };

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "border-warning/40 bg-warning/15 text-warning",
  completed: "border-success/40 bg-success/15 text-success",
  cancelled: "border-danger/40 bg-danger/15 text-danger",
  refunded: "border-text-muted/40 bg-text-muted/15 text-text-muted",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrdersClient({ orders }: Props) {
  const [selected, setSelected] = useState<OrderRow | null>(null);

  return (
    <>
      {orders.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="w-28 p-3">Marchio</th>
                <th className="p-3">Cliente</th>
                <th className="w-32 p-3">Canale</th>
                <th className="w-40 p-3">Data</th>
                <th className="w-24 p-3 text-right">Totale</th>
                <th className="w-24 p-3">Stato</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted"
                >
                  <td className="p-3">
                    <BrandChip slug={o.brandSlug} name={o.brandDisplayName} color={o.brandColor} />
                  </td>
                  <td className="p-3">
                    {o.contactFullName ? (
                      <span className="inline-flex items-center gap-1.5 text-text">
                        <UserCircle2 className="h-3.5 w-3.5" /> {o.contactFullName}
                      </span>
                    ) : (
                      <span className="text-text-muted italic">Ospite</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-text-muted">{ORDER_CHANNEL_LABELS[o.channel]}</td>
                  <td className="p-3 text-xs text-text-muted">{formatDateTime(o.placedAt)}</td>
                  <td className="p-3 text-right font-mono text-sm">{formatCents(o.totalCents)}</td>
                  <td className="p-3">
                    <Badge className={`border ${STATUS_STYLE[o.status]}`}>
                      {ORDER_STATUS_LABELS[o.status]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected && <OrderDetailDrawer order={selected} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function OrderDetailDrawer({ order }: { order: OrderRow }) {
  const [lines, setLines] = useState<OrderLine[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useState(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/ordini/${order.id}/lines`, { cache: "no-store" });
        if (!res.ok) throw new Error("Errore caricamento righe");
        const data = (await res.json()) as { lines: OrderLine[] };
        setLines(data.lines);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  });

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
          Ordine
          <BrandChip
            slug={order.brandSlug}
            name={order.brandDisplayName}
            color={order.brandColor}
          />
        </SheetTitle>
      </SheetHeader>

      <div className="mt-4 space-y-6 px-4 pb-8">
        {/* Header info */}
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Data</div>
              <div className="text-text">{formatDateTime(order.placedAt)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Canale</div>
              <div className="text-text">{ORDER_CHANNEL_LABELS[order.channel]}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Stato</div>
              <Badge className={`border ${STATUS_STYLE[order.status]}`}>
                {ORDER_STATUS_LABELS[order.status]}
              </Badge>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">Totale</div>
              <div
                className="text-2xl font-bold text-text"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                {formatCents(order.totalCents)}
              </div>
            </div>
          </div>
          {order.externalRef && (
            <div className="mt-2 border-t border-border pt-2 text-xs text-text-muted">
              <strong>Riferimento gestionale:</strong> <code>{order.externalRef}</code>
            </div>
          )}
          {order.notes && <div className="mt-1 text-xs text-text-muted italic">{order.notes}</div>}
        </section>

        {/* Cliente */}
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <UserCircle2 className="h-3.5 w-3.5" /> Cliente
          </div>
          {order.contactId && order.contactFullName ? (
            <Link
              href={`/contatti?q=${encodeURIComponent(order.contactFullName)}`}
              className="text-primary underline hover:no-underline"
            >
              {order.contactFullName}
            </Link>
          ) : (
            <span className="italic text-text-muted">Ospite (nessun contatto associato)</span>
          )}
        </section>

        {/* Righe */}
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <Truck className="h-3.5 w-3.5" /> Righe ordine
          </div>
          {loading && <p className="text-xs text-text-muted">Caricamento...</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
          {lines && lines.length === 0 && (
            <p className="text-xs text-text-muted">Nessuna riga (probabilmente ordine seed).</p>
          )}
          {lines && lines.length > 0 && (
            <table className="w-full text-xs">
              <thead className="border-b border-border text-left text-text-muted">
                <tr>
                  <th className="py-1.5">Prodotto</th>
                  <th className="w-16 py-1.5 text-right">Qta</th>
                  <th className="w-24 py-1.5 text-right">Unit.</th>
                  <th className="w-24 py-1.5 text-right">Totale</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-border/40 last:border-0">
                    <td className="py-1.5 text-text">{l.nameSnapshot}</td>
                    <td className="py-1.5 text-right text-text-muted">{l.quantity}</td>
                    <td className="py-1.5 text-right text-text-muted">
                      {formatCents(l.unitPriceCents)}
                    </td>
                    <td className="py-1.5 text-right font-medium text-text">
                      {formatCents(l.lineTotalCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
