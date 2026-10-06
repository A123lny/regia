"use client";

// Client per pagina Fedeltà: tab (Contatori · Offerte · Voucher · Riscatta).
// Contatori e offerte con dialog CRUD, voucher con lista + filtri + form emissione.

import { useState, useEffect, useTransition } from "react";
import { Plus, TicketCheck, Gift, Ticket, ScanBarcode, Search, X as XIcon } from "lucide-react";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  upsertCounterAction,
  upsertOfferAction,
  issueVoucherAction,
  redeemVoucherByCodeAction,
  cancelVoucherAction,
  COUNTER_KIND_LABELS,
  COUNTER_RESET_LABELS,
  REWARD_KIND_LABELS,
  VOUCHER_STATUS_LABELS,
  formatReward,
} from "@/modules/m06-loyalty/public";
import type {
  LoyaltyCounter,
  CounterKind,
  CounterResetMode,
  OfferRow,
  VoucherRow,
  RewardKind,
  VoucherStatus,
} from "@/modules/m06-loyalty/public";

type CounterRow = LoyaltyCounter & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
};

type BrandOpt = { id: string; slug: string; displayName: string; color: string };

// RF-9.3 attribuzione: dropdown "da quale post?" nell'issue form
export type RecentDraftOpt = {
  id: string;
  title: string;
  brandDisplayName: string;
  status: string;
  publishedAt: string | null;
  scheduledFor: string | null;
};

type Props = {
  counters: CounterRow[];
  offers: OfferRow[];
  brands: BrandOpt[];
  recentDrafts: RecentDraftOpt[];
  canCrudCounters: boolean;
  canCrudOffers: boolean;
  canIssue: boolean;
  canRedeem: boolean;
  canCancel: boolean;
};

type Tab = "contatori" | "offerte" | "voucher" | "riscatta";

export function LoyaltyClient(props: Props) {
  const [tab, setTab] = useState<Tab>("voucher");

  const tabs: Array<{ key: Tab; label: string; icon: typeof Gift }> = [
    { key: "voucher", label: "Voucher emessi", icon: TicketCheck },
    { key: "riscatta", label: "Riscatta", icon: ScanBarcode },
    { key: "offerte", label: "Offerte", icon: Gift },
    { key: "contatori", label: "Contatori", icon: Ticket },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "voucher" && (
        <VouchersTab
          offers={props.offers}
          recentDrafts={props.recentDrafts}
          canIssue={props.canIssue}
          canCancel={props.canCancel}
        />
      )}
      {tab === "riscatta" && <RedeemTab canRedeem={props.canRedeem} />}
      {tab === "offerte" && (
        <OffersTab
          offers={props.offers}
          counters={props.counters}
          brands={props.brands}
          canCrud={props.canCrudOffers}
        />
      )}
      {tab === "contatori" && (
        <CountersTab
          counters={props.counters}
          brands={props.brands}
          canCrud={props.canCrudCounters}
        />
      )}
    </div>
  );
}

// ============================================================================
// COUNTERS TAB
// ============================================================================

function CountersTab({
  counters,
  brands,
  canCrud,
}: {
  counters: CounterRow[];
  brands: BrandOpt[];
  canCrud: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CounterRow | null>(null);

  return (
    <div className="space-y-3">
      {canCrud && (
        <div className="flex justify-end">
          <Sheet
            open={dialogOpen}
            onOpenChange={(o) => {
              setDialogOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <SheetTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary-hover">
                <Plus className="mr-2 h-4 w-4" /> Nuovo contatore
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="font-serif">
                  {editing ? "Modifica contatore" : "Nuovo contatore"}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 pb-8">
                <CounterForm
                  brands={brands}
                  initial={editing}
                  onDone={() => {
                    setDialogOpen(false);
                    setEditing(null);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {counters.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessun contatore configurato.
          {canCrud && " Crea il primo con il bottone in alto."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="w-28 p-3">Marchio</th>
                <th className="p-3">Contatore</th>
                <th className="w-32 p-3">Cosa conta</th>
                <th className="w-24 p-3">Soglia</th>
                <th className="w-32 p-3">Azzeramento</th>
                <th className="w-24 p-3">Stato</th>
              </tr>
            </thead>
            <tbody>
              {counters.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => {
                    if (canCrud) {
                      setEditing(c);
                      setDialogOpen(true);
                    }
                  }}
                  className={`border-b border-border/60 last:border-0 ${
                    canCrud ? "cursor-pointer hover:bg-surface-muted" : ""
                  }`}
                >
                  <td className="p-3">
                    <BrandChip slug={c.brandSlug} name={c.brandDisplayName} color={c.brandColor} />
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-text">{c.name}</div>
                    {c.description && (
                      <div className="text-xs text-text-muted">{c.description}</div>
                    )}
                  </td>
                  <td className="p-3 text-xs text-text-muted">{COUNTER_KIND_LABELS[c.kind]}</td>
                  <td className="p-3 text-xs">
                    {c.kind === "valore_speso" && c.thresholdValueCents !== null
                      ? `${(c.thresholdValueCents / 100).toFixed(2)} €`
                      : c.thresholdCount}
                  </td>
                  <td className="p-3 text-xs text-text-muted">
                    {COUNTER_RESET_LABELS[c.resetMode]}
                  </td>
                  <td className="p-3">
                    {c.isActive ? (
                      <Badge className="border border-success/30 bg-success/15 text-success">
                        Attivo
                      </Badge>
                    ) : (
                      <Badge className="border border-border bg-surface-muted text-text-muted">
                        Sospeso
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CounterForm({
  brands,
  initial,
  onDone,
}: {
  brands: BrandOpt[];
  initial: CounterRow | null;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<CounterKind>(initial?.kind ?? "passaggi");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const payload: Parameters<typeof upsertCounterAction>[0] = {
            brandId: String(fd.get("brandId") ?? ""),
            name: String(fd.get("name") ?? ""),
            kind: (String(fd.get("kind") ?? "passaggi") || "passaggi") as CounterKind,
            resetMode: (String(fd.get("resetMode") ?? "dopo_premio") ||
              "dopo_premio") as CounterResetMode,
            isActive: fd.get("isActive") === "on",
          };
          if (initial) payload.counterId = initial.id;
          const desc = String(fd.get("description") ?? "").trim();
          if (desc) payload.description = desc;

          if (payload.kind === "valore_speso") {
            const euro = String(fd.get("thresholdValueEuro") ?? "").trim();
            if (euro) payload.thresholdValueCents = Math.round(parseFloat(euro) * 100);
          } else {
            const count = String(fd.get("thresholdCount") ?? "").trim();
            if (count) payload.thresholdCount = parseInt(count, 10);
          }

          const result = await upsertCounterAction(payload);
          if (result.ok) onDone();
          else setError(result.error);
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="brandId">Marchio</Label>
        <select
          id="brandId"
          name="brandId"
          required
          defaultValue={initial?.brandId ?? brands[0]?.id ?? ""}
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.displayName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={initial?.name ?? ""}
          placeholder="es. 10 lavaggi = 1 gratis"
        />
      </div>
      <div>
        <Label htmlFor="description">Descrizione</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={initial?.description ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="kind">Cosa conta</Label>
        <select
          id="kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as CounterKind)}
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          {(Object.keys(COUNTER_KIND_LABELS) as CounterKind[]).map((k) => (
            <option key={k} value={k}>
              {COUNTER_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      {kind === "valore_speso" ? (
        <div>
          <Label htmlFor="thresholdValueEuro">Soglia (€ spesi)</Label>
          <Input
            id="thresholdValueEuro"
            name="thresholdValueEuro"
            type="number"
            step="0.01"
            min={0.01}
            required
            defaultValue={
              initial?.thresholdValueCents !== null && initial?.thresholdValueCents !== undefined
                ? (initial.thresholdValueCents / 100).toFixed(2)
                : ""
            }
          />
        </div>
      ) : (
        <div>
          <Label htmlFor="thresholdCount">Soglia (numero)</Label>
          <Input
            id="thresholdCount"
            name="thresholdCount"
            type="number"
            min={1}
            required
            defaultValue={initial?.thresholdCount ?? ""}
          />
        </div>
      )}
      <div>
        <Label htmlFor="resetMode">Azzeramento</Label>
        <select
          id="resetMode"
          name="resetMode"
          defaultValue={initial?.resetMode ?? "dopo_premio"}
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          {(Object.keys(COUNTER_RESET_LABELS) as CounterResetMode[]).map((m) => (
            <option key={m} value={m}>
              {COUNTER_RESET_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial?.isActive ?? true}
          className="h-4 w-4 accent-primary"
        />
        Attivo
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Annulla
        </Button>
        <Button
          type="submit"
          disabled={pending}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          {pending ? "Salvo..." : "Salva"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// OFFERS TAB
// ============================================================================

function OffersTab({
  offers,
  counters,
  brands,
  canCrud,
}: {
  offers: OfferRow[];
  counters: CounterRow[];
  brands: BrandOpt[];
  canCrud: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OfferRow | null>(null);

  return (
    <div className="space-y-3">
      {canCrud && (
        <div className="flex justify-end">
          <Sheet
            open={dialogOpen}
            onOpenChange={(o) => {
              setDialogOpen(o);
              if (!o) setEditing(null);
            }}
          >
            <SheetTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary-hover">
                <Plus className="mr-2 h-4 w-4" /> Nuova offerta
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="font-serif">
                  {editing ? "Modifica offerta" : "Nuova offerta"}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 pb-8">
                <OfferForm
                  brands={brands}
                  counters={counters}
                  initial={editing}
                  onDone={() => {
                    setDialogOpen(false);
                    setEditing(null);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {offers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessuna offerta configurata.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="p-3">Offerta</th>
                <th className="w-32 p-3">Emesso da</th>
                <th className="w-32 p-3">Spendibile su</th>
                <th className="w-32 p-3">Premio</th>
                <th className="w-24 p-3">Scadenza</th>
                <th className="w-24 p-3">Stato</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => {
                    if (canCrud) {
                      setEditing(o);
                      setDialogOpen(true);
                    }
                  }}
                  className={`border-b border-border/60 last:border-0 ${
                    canCrud ? "cursor-pointer hover:bg-surface-muted" : ""
                  }`}
                >
                  <td className="p-3">
                    <div className="font-medium text-text">{o.name}</div>
                    {o.description && (
                      <div className="text-xs text-text-muted">{o.description}</div>
                    )}
                  </td>
                  <td className="p-3">
                    <BrandChip
                      slug={o.issuerBrandSlug}
                      name={o.issuerBrandDisplayName}
                      color={o.issuerBrandColor}
                    />
                  </td>
                  <td className="p-3">
                    <BrandChip
                      slug={o.spendableBrandSlug}
                      name={o.spendableBrandDisplayName}
                      color={o.spendableBrandColor}
                    />
                  </td>
                  <td className="p-3 text-sm font-medium text-text">
                    {formatReward(o.rewardKind, o.rewardValueCents, o.rewardPct, o.rewardLabel)}
                  </td>
                  <td className="p-3 text-xs text-text-muted">{o.defaultExpiresDays} gg</td>
                  <td className="p-3">
                    {o.isActive ? (
                      <Badge className="border border-success/30 bg-success/15 text-success">
                        Attiva
                      </Badge>
                    ) : (
                      <Badge className="border border-border bg-surface-muted text-text-muted">
                        Sospesa
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OfferForm({
  brands,
  counters,
  initial,
  onDone,
}: {
  brands: BrandOpt[];
  counters: CounterRow[];
  initial: OfferRow | null;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rewardKind, setRewardKind] = useState<RewardKind>(initial?.rewardKind ?? "valore_fisso");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const payload: Parameters<typeof upsertOfferAction>[0] = {
            issuerBrandId: String(fd.get("issuerBrandId") ?? ""),
            spendableBrandId: String(fd.get("spendableBrandId") ?? ""),
            name: String(fd.get("name") ?? ""),
            rewardKind,
            defaultExpiresDays: parseInt(String(fd.get("defaultExpiresDays") ?? "60"), 10),
            cumulable: fd.get("cumulable") === "on",
            isActive: fd.get("isActive") === "on",
          };
          if (initial) payload.offerId = initial.id;

          const counterId = String(fd.get("counterId") ?? "").trim();
          if (counterId) payload.counterId = counterId;

          const desc = String(fd.get("description") ?? "").trim();
          if (desc) payload.description = desc;

          if (rewardKind === "valore_fisso") {
            const euro = String(fd.get("rewardEuro") ?? "").trim();
            if (euro) payload.rewardValueCents = Math.round(parseFloat(euro) * 100);
          } else if (rewardKind === "percentuale") {
            const pct = String(fd.get("rewardPct") ?? "").trim();
            if (pct) payload.rewardPct = parseFloat(pct);
          } else {
            const label = String(fd.get("rewardLabel") ?? "").trim();
            if (label) payload.rewardLabel = label;
          }

          const result = await upsertOfferAction(payload);
          if (result.ok) onDone();
          else setError(result.error);
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="name">Nome offerta</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={initial?.name ?? ""}
          placeholder="es. 11° lavaggio gratis"
        />
      </div>
      <div>
        <Label htmlFor="description">Descrizione</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={initial?.description ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="issuerBrandId">Marchio che emette</Label>
          <select
            id="issuerBrandId"
            name="issuerBrandId"
            required
            defaultValue={initial?.issuerBrandId ?? brands[0]?.id ?? ""}
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="spendableBrandId">Spendibile su</Label>
          <select
            id="spendableBrandId"
            name="spendableBrandId"
            required
            defaultValue={initial?.spendableBrandId ?? brands[0]?.id ?? ""}
            className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="counterId">Legato a contatore (opzionale)</Label>
        <select
          id="counterId"
          name="counterId"
          defaultValue={initial?.counterId ?? ""}
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          <option value="">— nessuno (emissione manuale) —</option>
          {counters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.brandDisplayName})
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="rewardKind">Tipo premio</Label>
        <select
          id="rewardKind"
          name="rewardKind"
          value={rewardKind}
          onChange={(e) => setRewardKind(e.target.value as RewardKind)}
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          {(Object.keys(REWARD_KIND_LABELS) as RewardKind[]).map((k) => (
            <option key={k} value={k}>
              {REWARD_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      {rewardKind === "valore_fisso" && (
        <div>
          <Label htmlFor="rewardEuro">Valore (€)</Label>
          <Input
            id="rewardEuro"
            name="rewardEuro"
            type="number"
            step="0.01"
            min={0.01}
            required
            defaultValue={
              initial?.rewardValueCents !== null && initial?.rewardValueCents !== undefined
                ? (initial.rewardValueCents / 100).toFixed(2)
                : ""
            }
          />
        </div>
      )}
      {rewardKind === "percentuale" && (
        <div>
          <Label htmlFor="rewardPct">Sconto (%)</Label>
          <Input
            id="rewardPct"
            name="rewardPct"
            type="number"
            step="0.1"
            min={0.1}
            max={100}
            required
            defaultValue={initial?.rewardPct ?? ""}
          />
        </div>
      )}
      {rewardKind === "servizio_gratis" && (
        <div>
          <Label htmlFor="rewardLabel">Descrizione servizio</Label>
          <Input
            id="rewardLabel"
            name="rewardLabel"
            required
            maxLength={200}
            defaultValue={initial?.rewardLabel ?? ""}
            placeholder="es. Lavaggio esterno standard"
          />
        </div>
      )}
      <div>
        <Label htmlFor="defaultExpiresDays">Scadenza voucher (giorni dall&apos;emissione)</Label>
        <Input
          id="defaultExpiresDays"
          name="defaultExpiresDays"
          type="number"
          min={1}
          required
          defaultValue={initial?.defaultExpiresDays ?? 60}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="cumulable"
          defaultChecked={initial?.cumulable ?? false}
          className="h-4 w-4 accent-primary"
        />
        Cumulabile con altre offerte
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={initial?.isActive ?? true}
          className="h-4 w-4 accent-primary"
        />
        Attiva
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Annulla
        </Button>
        <Button
          type="submit"
          disabled={pending}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          {pending ? "Salvo..." : "Salva"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// VOUCHERS TAB
// ============================================================================

const VOUCHER_STATUS_STYLE: Record<VoucherStatus, string> = {
  issued: "border-primary/40 bg-primary/15 text-primary",
  redeemed: "border-success/40 bg-success/15 text-success",
  expired: "border-warning/40 bg-warning/15 text-warning",
  cancelled: "border-danger/40 bg-danger/15 text-danger",
};

function VouchersTab({
  offers,
  recentDrafts,
  canIssue,
  canCancel,
}: {
  offers: OfferRow[];
  recentDrafts: RecentDraftOpt[];
  canIssue: boolean;
  canCancel: boolean;
}) {
  const [issueOpen, setIssueOpen] = useState(false);
  const [status, setStatus] = useState<VoucherStatus | "">("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<VoucherRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Mark loading tramite microtask per evitare cascading render (regola react-hooks/set-state-in-effect)
      if (!cancelled) setItems(null);
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/fedelta/voucher?${params.toString()}`, {
        cache: "no-store",
      });
      if (!cancelled) {
        const data = (await res.json()) as { items: VoucherRow[] };
        setItems(data.items);
        setLoading(false);
      }
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [status, query, reload]);

  return (
    <div className="space-y-3">
      {/* Filtri + bottone emissione */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca codice..."
            className="w-full rounded-md border border-border bg-bg py-1.5 pl-8 pr-2 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as VoucherStatus | "")}
          className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
        >
          <option value="">Tutti gli stati</option>
          {(Object.keys(VOUCHER_STATUS_LABELS) as VoucherStatus[]).map((s) => (
            <option key={s} value={s}>
              {VOUCHER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {canIssue && (
          <Sheet open={issueOpen} onOpenChange={setIssueOpen}>
            <SheetTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary-hover">
                <Plus className="mr-2 h-4 w-4" /> Emetti voucher
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="font-serif">Emetti voucher</SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 pb-8">
                <IssueVoucherForm
                  offers={offers.filter((o) => o.isActive)}
                  recentDrafts={recentDrafts}
                  onDone={() => {
                    setIssueOpen(false);
                    setReload((r) => r + 1);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {loading && (
        <div className="rounded-lg border border-border bg-surface p-6 text-center text-sm text-text-muted">
          Caricamento...
        </div>
      )}

      {!loading && items && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessun voucher trovato.
        </div>
      )}

      {!loading && items && items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="w-32 p-3">Codice</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Offerta</th>
                <th className="w-28 p-3">Premio</th>
                <th className="w-28 p-3">Scadenza</th>
                <th className="w-28 p-3">Stato</th>
                {canCancel && <th className="w-16 p-3" />}
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-border/60 last:border-0 hover:bg-surface-muted"
                >
                  <td className="p-3">
                    <code className="rounded bg-surface-muted px-2 py-0.5 text-xs font-mono font-medium">
                      {v.code}
                    </code>
                  </td>
                  <td className="p-3 text-text">
                    {v.contactFullName ?? (
                      <span className="italic text-text-muted">Senza nome</span>
                    )}
                    {v.contactEmail && (
                      <div className="text-[11px] text-text-muted">{v.contactEmail}</div>
                    )}
                  </td>
                  <td className="p-3 text-xs text-text-muted">{v.offerName}</td>
                  <td className="p-3 text-sm font-medium">
                    {formatReward(v.rewardKind, v.rewardValueCents, v.rewardPct, v.rewardLabel)}
                  </td>
                  <td className="p-3 text-xs text-text-muted">
                    {new Date(v.expiresAt).toLocaleDateString("it-IT")}
                  </td>
                  <td className="p-3">
                    <Badge className={`border ${VOUCHER_STATUS_STYLE[v.status]}`}>
                      {VOUCHER_STATUS_LABELS[v.status]}
                    </Badge>
                  </td>
                  {canCancel && (
                    <td className="p-3">
                      {v.status === "issued" && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={async () => {
                            const reason = window.prompt("Motivo annullamento:");
                            if (!reason || reason.trim().length < 3) return;
                            startTransition(async () => {
                              const r = await cancelVoucherAction(v.id, reason.trim());
                              if (r.ok) setReload((x) => x + 1);
                            });
                          }}
                          className="rounded-md p-1 text-text-muted hover:bg-danger/10 hover:text-danger"
                          aria-label="Annulla voucher"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IssueVoucherForm({
  offers,
  recentDrafts,
  onDone,
}: {
  offers: OfferRow[];
  recentDrafts: RecentDraftOpt[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ code: string } | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const [contacts, setContacts] = useState<
    Array<{ id: string; firstName: string | null; lastName: string | null; email: string | null }>
  >([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // Autocomplete contatti (fetch on-demand con debounce implicito via useEffect)
  useEffect(() => {
    let cancelled = false;
    if (contactQuery.trim().length < 2) {
      // clear contatti via async microtask per non violare react-hooks/set-state-in-effect
      Promise.resolve().then(() => {
        if (!cancelled) setContacts([]);
      });
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      const res = await fetch(`/api/fedelta/contatti-search?q=${encodeURIComponent(contactQuery)}`);
      if (!cancelled && res.ok) {
        const data = (await res.json()) as {
          items: Array<{
            id: string;
            first_name: string | null;
            last_name: string | null;
            email: string | null;
          }>;
        };
        setContacts(
          data.items.map((c) => ({
            id: c.id,
            firstName: c.first_name,
            lastName: c.last_name,
            email: c.email,
          })),
        );
      }
    })().catch(() => setContacts([]));
    return () => {
      cancelled = true;
    };
  }, [contactQuery]);

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <TicketCheck className="mx-auto h-10 w-10 text-success" />
        <div>
          <div className="text-sm text-text-muted">Voucher emesso con codice</div>
          <code className="mt-2 inline-block rounded bg-surface-muted px-4 py-2 text-lg font-mono font-bold text-primary">
            {success.code}
          </code>
        </div>
        <Button onClick={onDone} className="bg-primary text-white hover:bg-primary-hover">
          Chiudi
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        if (!selectedContactId) {
          setError("Seleziona un contatto");
          return;
        }
        const offerId = String(fd.get("offerId") ?? "");
        if (!offerId) {
          setError("Seleziona un'offerta");
          return;
        }
        startTransition(async () => {
          const payload: Parameters<typeof issueVoucherAction>[0] = {
            offerId,
            contactId: selectedContactId,
          };
          const notes = String(fd.get("notes") ?? "").trim();
          if (notes) payload.notes = notes;
          const sourceDraft = String(fd.get("sourceDraftId") ?? "").trim();
          if (sourceDraft) payload.sourceDraftId = sourceDraft;
          const result = await issueVoucherAction(payload);
          if (result.ok) {
            setSuccess({ code: result.code });
          } else {
            setError(result.error);
          }
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="offerId">Offerta</Label>
        <select
          id="offerId"
          name="offerId"
          required
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          <option value="">Seleziona offerta...</option>
          {offers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} —{" "}
              {formatReward(o.rewardKind, o.rewardValueCents, o.rewardPct, o.rewardLabel)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="contactQuery">Contatto</Label>
        <input
          type="text"
          id="contactQuery"
          value={contactQuery}
          onChange={(e) => {
            setContactQuery(e.target.value);
            setSelectedContactId(null);
          }}
          placeholder="Cerca per nome o email..."
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        {contactQuery.length >= 2 && !selectedContactId && (
          <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-surface">
            {contacts.length === 0 ? (
              <div className="p-2 text-xs text-text-muted">Nessun contatto</div>
            ) : (
              contacts.map((c) => {
                const parts = [c.firstName, c.lastName].filter(Boolean);
                const name = parts.length > 0 ? parts.join(" ") : "(senza nome)";
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedContactId(c.id);
                      setContactQuery(name + (c.email ? ` — ${c.email}` : ""));
                    }}
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-surface-muted"
                  >
                    <span className="font-medium">{name}</span>
                    {c.email && <span className="text-text-muted"> · {c.email}</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="sourceDraftId">Attribuisci a un post (opzionale, RF-9.3)</Label>
        <select
          id="sourceDraftId"
          name="sourceDraftId"
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          <option value="">— Nessuna attribuzione (emesso al banco)</option>
          {recentDrafts.length === 0 && (
            <option disabled>Nessun post programmato o pubblicato di recente</option>
          )}
          {recentDrafts.map((d) => {
            const date = d.publishedAt ?? d.scheduledFor;
            const dateStr = date
              ? new Date(date).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                })
              : "";
            return (
              <option key={d.id} value={d.id}>
                [{d.brandDisplayName}] {d.title} {dateStr && `· ${dateStr}`}
              </option>
            );
          })}
        </select>
      </div>
      <div>
        <Label htmlFor="notes">Note (opzionale)</Label>
        <Textarea id="notes" name="notes" rows={2} maxLength={500} />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Annulla
        </Button>
        <Button
          type="submit"
          disabled={pending}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          {pending ? "Emetto..." : "Emetti voucher"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// REDEEM TAB
// ============================================================================

function RedeemTab({ canRedeem }: { canRedeem: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { kind: "success"; text: string } | { kind: "error"; text: string } | null
  >(null);
  const [code, setCode] = useState("");

  if (!canRedeem) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
        Non hai il permesso di riscattare voucher.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <ScanBarcode className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-text">Riscatta al banco</h3>
        </div>
        <p className="mb-4 text-xs text-text-muted">
          Inserisci il codice del voucher che il cliente ha ricevuto via email/WhatsApp/SMS. Il
          sistema valida uso singolo, scadenza e appartenenza (RF-6.26).
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            if (!code.trim()) return;
            startTransition(async () => {
              const result = await redeemVoucherByCodeAction(code.trim());
              if (result.ok) {
                setMessage({
                  kind: "success",
                  text: result.contactFullName
                    ? `Voucher riscattato — ${result.contactFullName}`
                    : "Voucher riscattato",
                });
                setCode("");
              } else {
                setMessage({ kind: "error", text: result.error });
              }
            });
          }}
          className="space-y-3"
        >
          <div>
            <Label htmlFor="code">Codice voucher</Label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="es. AB7X9K2M"
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-3 text-center font-mono text-xl font-bold uppercase tracking-widest focus:border-primary focus:outline-none"
              maxLength={20}
              autoComplete="off"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            disabled={pending || !code.trim()}
            className="w-full bg-primary py-6 text-base font-semibold text-white hover:bg-primary-hover"
          >
            {pending ? "Verifico..." : "Riscatta"}
          </Button>
        </form>
      </div>

      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.kind === "success"
              ? "border-success/40 bg-success/10 text-success"
              : "border-danger/40 bg-danger/10 text-danger"
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
