"use client";

// Client rete ristoranti: lista + drawer con timeline attività + form log + form partner.

import { useState, useEffect, useTransition } from "react";
import {
  Plus,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  Clock,
  UserRound,
  ChefHat,
  FileBarChart,
  Copy,
  Check as CheckIcon,
  Rocket,
  PackageX,
  Plus as PlusIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  upsertPartnerAction,
  logActivityAction,
  toggleCoolingAction,
  generateMonthlyReportAction,
  getLaunchStatusAction,
  updateLaunchNotesAction,
  recordDeliveryErrorAction,
  getPartnerErrorsAction,
  LAUNCH_WINDOW_DAYS,
  ACTIVITY_KIND_LABELS,
  ACTIVITY_OUTCOME_LABELS,
  ONBOARDING_STATUS_LABELS,
  SEVERITY_LABELS,
  SEVERITY_STYLES,
  daysSinceLastContact,
} from "@/modules/m07-partners/public";
import type {
  ActivityKind,
  ActivityOutcome,
  OnboardingStatus,
  PartnerActivity,
  PartnerRestaurant,
  MonthlyPartnerReport,
  PartnerLaunchStatus,
  DeliveryError,
  DeliveryErrorSeverity,
  PartnerErrorsSummary,
} from "@/modules/m07-partners/public";

type Props = {
  partners: PartnerRestaurant[];
  lennyBrandId: string;
  canCrud: boolean;
  canLogActivity: boolean;
};

const STATUS_STYLE: Record<OnboardingStatus, string> = {
  mai_partito: "border-warning/40 bg-warning/15 text-warning",
  attivo: "border-success/40 bg-success/15 text-success",
  sospeso: "border-text-muted/40 bg-text-muted/15 text-text-muted",
  uscito: "border-danger/40 bg-danger/15 text-danger",
};

const OUTCOME_STYLE: Record<ActivityOutcome, string> = {
  positivo: "border-success/40 bg-success/15 text-success",
  neutro: "border-border bg-surface-muted text-text-muted",
  negativo: "border-danger/40 bg-danger/15 text-danger",
  da_richiamare: "border-warning/40 bg-warning/15 text-warning",
};

export function PartnersClient({ partners, lennyBrandId, canCrud, canLogActivity }: Props) {
  const [selected, setSelected] = useState<PartnerRestaurant | null>(null);
  const [newPartnerOpen, setNewPartnerOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div />
        {canCrud && (
          <Sheet open={newPartnerOpen} onOpenChange={setNewPartnerOpen}>
            <SheetTrigger asChild>
              <Button className="bg-primary text-white hover:bg-primary-hover">
                <Plus className="mr-2 h-4 w-4" /> Nuovo ristorante
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
              <SheetHeader>
                <SheetTitle className="font-serif">Nuovo ristorante</SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 pb-8">
                <PartnerForm
                  brandId={lennyBrandId}
                  initial={null}
                  onDone={() => setNewPartnerOpen(false)}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {partners.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="p-3">Ristorante</th>
                <th className="w-32 p-3">Cucina</th>
                <th className="w-32 p-3">Referente</th>
                <th className="w-24 p-3">Tempo</th>
                <th className="w-32 p-3">Ultimo contatto</th>
                <th className="w-28 p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((p) => {
                const days = daysSinceLastContact(p.lastContactAt);
                const overdue = days === null || days > 30;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelected(p)}
                    className={`cursor-pointer border-b border-border/60 last:border-0 hover:bg-surface-muted ${
                      p.archivedAt ? "opacity-60" : ""
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {p.coolingFlag && (
                          <AlertTriangle
                            className="h-3.5 w-3.5 text-warning"
                            aria-label="In raffreddamento"
                          />
                        )}
                        <div>
                          <div className="font-medium text-text">{p.name}</div>
                          {p.addressCity && (
                            <div className="text-xs text-text-muted">{p.addressCity}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-xs text-text-muted">{p.cuisineCategory ?? "—"}</td>
                    <td className="p-3 text-xs">
                      {p.referentName ?? <span className="text-text-muted italic">—</span>}
                      {p.phone && <div className="text-text-muted">{p.phone}</div>}
                    </td>
                    <td className="p-3 text-xs text-text-muted">
                      {p.avgPrepMinutes !== null ? `${p.avgPrepMinutes} min` : "—"}
                    </td>
                    <td className="p-3 text-xs">
                      {days === null ? (
                        <span className="italic text-text-muted">mai</span>
                      ) : (
                        <span className={overdue ? "text-warning" : "text-text-muted"}>
                          {days} giorn{days === 1 ? "o" : "i"} fa
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col items-start gap-1">
                        <Badge className={`border ${STATUS_STYLE[p.onboardingStatus]}`}>
                          {ONBOARDING_STATUS_LABELS[p.onboardingStatus]}
                        </Badge>
                        {p.coolingFlag && (
                          <Badge className="border border-warning/40 bg-warning/10 text-warning">
                            In raffreddamento
                          </Badge>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <PartnerDetailDrawer
              partner={selected}
              brandId={lennyBrandId}
              canCrud={canCrud}
              canLogActivity={canLogActivity}
              onClose={() => setSelected(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ============================================================================
// Partner form (nuovo/edit)
// ============================================================================

function PartnerForm({
  brandId,
  initial,
  onDone,
}: {
  brandId: string;
  initial: PartnerRestaurant | null;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [coolingFlag, setCoolingFlag] = useState(initial?.coolingFlag ?? false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const payload: Parameters<typeof upsertPartnerAction>[0] = {
            brandId,
            name: String(fd.get("name") ?? ""),
            onboardingStatus: (String(fd.get("onboardingStatus") ?? "mai_partito") ||
              "mai_partito") as OnboardingStatus,
            coolingFlag,
          };
          if (initial) payload.partnerId = initial.id;
          const ref = String(fd.get("referentName") ?? "").trim();
          if (ref) payload.referentName = ref;
          const ph = String(fd.get("phone") ?? "").trim();
          if (ph) payload.phone = ph;
          const em = String(fd.get("email") ?? "").trim();
          if (em) payload.email = em;
          const city = String(fd.get("addressCity") ?? "").trim();
          if (city) payload.addressCity = city;
          const cuis = String(fd.get("cuisineCategory") ?? "").trim();
          if (cuis) payload.cuisineCategory = cuis;
          const prep = String(fd.get("avgPrepMinutes") ?? "").trim();
          if (prep) payload.avgPrepMinutes = parseInt(prep, 10);
          const notes = String(fd.get("notes") ?? "").trim();
          if (notes) payload.notes = notes;
          if (coolingFlag) {
            const reason = String(fd.get("coolingReason") ?? "").trim();
            if (reason) payload.coolingReason = reason;
          }

          const result = await upsertPartnerAction(payload);
          if (result.ok) onDone();
          else setError(result.error);
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="name">Nome ristorante</Label>
        <Input id="name" name="name" required maxLength={200} defaultValue={initial?.name ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="referentName">Referente</Label>
          <Input
            id="referentName"
            name="referentName"
            maxLength={200}
            defaultValue={initial?.referentName ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="phone">Telefono</Label>
          <Input id="phone" name="phone" maxLength={40} defaultValue={initial?.phone ?? ""} />
        </div>
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          maxLength={200}
          defaultValue={initial?.email ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="addressCity">Città</Label>
          <Input
            id="addressCity"
            name="addressCity"
            maxLength={100}
            defaultValue={initial?.addressCity ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="cuisineCategory">Cucina</Label>
          <Input
            id="cuisineCategory"
            name="cuisineCategory"
            maxLength={100}
            defaultValue={initial?.cuisineCategory ?? ""}
            placeholder="es. Pizza, Sushi..."
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="avgPrepMinutes">Tempo medio (min)</Label>
          <Input
            id="avgPrepMinutes"
            name="avgPrepMinutes"
            type="number"
            min={0}
            defaultValue={initial?.avgPrepMinutes ?? ""}
          />
        </div>
        <div>
          <Label htmlFor="onboardingStatus">Status</Label>
          <select
            id="onboardingStatus"
            name="onboardingStatus"
            defaultValue={initial?.onboardingStatus ?? "mai_partito"}
            className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
          >
            {(Object.keys(ONBOARDING_STATUS_LABELS) as OnboardingStatus[]).map((s) => (
              <option key={s} value={s}>
                {ONBOARDING_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-md border border-border bg-bg p-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={coolingFlag}
            onChange={(e) => setCoolingFlag(e.target.checked)}
            className="h-4 w-4 accent-warning"
          />
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
          In raffreddamento (RF-7.4)
        </label>
        {coolingFlag && (
          <div className="mt-2">
            <Label htmlFor="coolingReason" className="text-xs">
              Motivo (obbligatorio)
            </Label>
            <Textarea
              id="coolingReason"
              name="coolingReason"
              rows={2}
              maxLength={500}
              defaultValue={initial?.coolingReason ?? ""}
              placeholder="es. Ordini in calo del 40% ultimo mese"
              required={coolingFlag}
            />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="notes">Note</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={1000}
          defaultValue={initial?.notes ?? ""}
        />
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
          {pending ? "Salvo..." : "Salva"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// Partner detail drawer
// ============================================================================

function PartnerDetailDrawer({
  partner,
  brandId,
  canCrud,
  canLogActivity,
  onClose,
}: {
  partner: PartnerRestaurant;
  brandId: string;
  canCrud: boolean;
  canLogActivity: boolean;
  onClose: () => void;
}) {
  const [activities, setActivities] = useState<PartnerActivity[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) setLoading(true);
      const res = await fetch(`/api/ristoranti/${partner.id}/activities`, {
        cache: "no-store",
      });
      if (!cancelled && res.ok) {
        const data = (await res.json()) as { activities: PartnerActivity[] };
        setActivities(data.activities);
      }
      if (!cancelled) setLoading(false);
    })().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [partner.id, reload]);

  if (editMode) {
    return (
      <>
        <SheetHeader>
          <SheetTitle className="font-serif">Modifica {partner.name}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 px-4 pb-8">
          <PartnerForm
            brandId={brandId}
            initial={partner}
            onDone={() => {
              setEditMode(false);
              onClose();
            }}
          />
        </div>
      </>
    );
  }

  const days = daysSinceLastContact(partner.lastContactAt);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2 font-serif text-2xl">
          {partner.coolingFlag && <AlertTriangle className="h-5 w-5 text-warning" />}
          {partner.name}
        </SheetTitle>
      </SheetHeader>

      <div className="mt-4 space-y-6 px-4 pb-8">
        {/* Recapiti */}
        <section className="space-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <Badge className={`border ${STATUS_STYLE[partner.onboardingStatus]}`}>
              {ONBOARDING_STATUS_LABELS[partner.onboardingStatus]}
            </Badge>
            {canCrud && (
              <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
                Modifica
              </Button>
            )}
          </div>
          <div className="space-y-1 text-text-muted">
            {partner.referentName && (
              <div className="flex items-center gap-2">
                <UserRound className="h-3.5 w-3.5" /> {partner.referentName}
              </div>
            )}
            {partner.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> {partner.phone}
              </div>
            )}
            {partner.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" /> {partner.email}
              </div>
            )}
            {partner.addressCity && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" /> {partner.addressCity}
              </div>
            )}
            {partner.cuisineCategory && (
              <div className="flex items-center gap-2">
                <ChefHat className="h-3.5 w-3.5" /> {partner.cuisineCategory}
              </div>
            )}
            {partner.avgPrepMinutes !== null && (
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" /> Tempo medio {partner.avgPrepMinutes} min (RF-7.5)
              </div>
            )}
          </div>
          <div className="mt-2 border-t border-border pt-2 text-xs text-text-muted">
            Ultimo contatto:{" "}
            {days === null ? (
              <span className="italic">mai</span>
            ) : (
              <span className={days > 30 ? "text-warning" : ""}>
                {days} giorn{days === 1 ? "o" : "i"} fa
              </span>
            )}
          </div>
          {partner.notes && (
            <div className="mt-1 text-xs italic text-text-muted">{partner.notes}</div>
          )}
        </section>

        {/* RN-48 Fase di lancio (compare solo se launched_at valorizzato) */}
        <LaunchCard partnerId={partner.id} canCrud={canCrud} />

        {/* RN-28 Errori consegna ristorante */}
        <DeliveryErrorsCard partnerId={partner.id} canCrud={canCrud} />

        {/* RN-47 Report mensile ristoratore */}
        {canCrud && <MonthlyReportCard partnerId={partner.id} />}

        {/* Cooling toggle */}
        {canCrud && (
          <CoolingCard
            partner={partner}
            onChange={() => {
              setReload((r) => r + 1);
              onClose();
            }}
          />
        )}

        {/* Activity log */}
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-text">Storico contatti (RF-7.2)</h3>

          {canLogActivity && (
            <LogActivityForm partnerId={partner.id} onLogged={() => setReload((r) => r + 1)} />
          )}

          {loading && <p className="text-xs text-text-muted">Caricamento...</p>}
          {activities && activities.length === 0 && (
            <p className="text-xs text-text-muted">Nessuna attività registrata.</p>
          )}
          {activities && activities.length > 0 && (
            <ul className="space-y-2">
              {activities.map((a) => (
                <li key={a.id} className="rounded-md border border-border bg-bg p-2 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-text">{ACTIVITY_KIND_LABELS[a.kind]}</span>
                    <div className="flex items-center gap-2">
                      {a.outcome && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] ${OUTCOME_STYLE[a.outcome]}`}
                        >
                          {ACTIVITY_OUTCOME_LABELS[a.outcome]}
                        </span>
                      )}
                      <span className="text-text-muted">
                        {new Date(a.occurredAt).toLocaleDateString("it-IT")}
                      </span>
                    </div>
                  </div>
                  <div className="text-text">{a.summary}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function CoolingCard({ partner, onChange }: { partner: PartnerRestaurant; onChange: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!partner.coolingFlag) {
    return (
      <section className="space-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const reason = String(fd.get("reason") ?? "").trim();
            if (!reason) {
              setError("Motivo obbligatorio");
              return;
            }
            setError(null);
            startTransition(async () => {
              const r = await toggleCoolingAction({
                partnerId: partner.id,
                coolingFlag: true,
                coolingReason: reason,
              });
              if (r.ok) onChange();
              else setError(r.error);
            });
          }}
          className="space-y-2"
        >
          <Label htmlFor="reason" className="flex items-center gap-1 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            Segna in raffreddamento (RF-7.4)
          </Label>
          <Textarea
            id="reason"
            name="reason"
            rows={2}
            placeholder="Motivo: es. ordini in calo, cliente insoddisfatto..."
            maxLength={500}
          />
          {error && <p className="text-[11px] text-danger">{error}</p>}
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              variant="outline"
              className="border-warning/40 text-warning hover:bg-warning/10"
            >
              {pending ? "..." : "Attiva raffreddamento"}
            </Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
      <div className="flex items-center gap-2 text-warning">
        <AlertTriangle className="h-4 w-4" />
        <h3 className="font-semibold">In raffreddamento</h3>
      </div>
      {partner.coolingReason && <p className="text-xs italic text-text">{partner.coolingReason}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const r = await toggleCoolingAction({
              partnerId: partner.id,
              coolingFlag: false,
            });
            if (r.ok) onChange();
            else setError(r.error);
          });
        }}
        className="flex justify-end"
      >
        <Button type="submit" size="sm" disabled={pending} variant="outline">
          {pending ? "..." : "Risolto — togli raffreddamento"}
        </Button>
      </form>
      {error && <p className="text-[11px] text-danger">{error}</p>}
    </section>
  );
}

function LogActivityForm({ partnerId, onLogged }: { partnerId: string; onLogged: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <Button variant="outline" size="sm" onClick={() => setExpanded(true)} className="w-full">
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Registra contatto
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const payload: Parameters<typeof logActivityAction>[0] = {
            partnerId,
            kind: (String(fd.get("kind") ?? "chiamata") || "chiamata") as ActivityKind,
            summary: String(fd.get("summary") ?? ""),
          };
          const oc = String(fd.get("outcome") ?? "").trim();
          if (oc) payload.outcome = oc as ActivityOutcome;

          const result = await logActivityAction(payload);
          if (result.ok) {
            setExpanded(false);
            onLogged();
          } else {
            setError(result.error);
          }
        });
      }}
      className="space-y-2 rounded-md border border-border bg-bg p-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="kind" className="text-xs">
            Tipo
          </Label>
          <select
            id="kind"
            name="kind"
            defaultValue="chiamata"
            className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
          >
            {(Object.keys(ACTIVITY_KIND_LABELS) as ActivityKind[]).map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="outcome" className="text-xs">
            Esito
          </Label>
          <select
            id="outcome"
            name="outcome"
            defaultValue=""
            className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
          >
            <option value="">—</option>
            {(Object.keys(ACTIVITY_OUTCOME_LABELS) as ActivityOutcome[]).map((o) => (
              <option key={o} value={o}>
                {ACTIVITY_OUTCOME_LABELS[o]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="summary" className="text-xs">
          Riassunto
        </Label>
        <Textarea
          id="summary"
          name="summary"
          rows={2}
          maxLength={500}
          required
          placeholder="Cosa hai detto, cosa ha detto lui, cosa succede dopo"
        />
      </div>
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <div className="flex justify-end gap-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => setExpanded(false)}>
          Annulla
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={pending}
          className="bg-primary text-white hover:bg-primary-hover"
        >
          {pending ? "..." : "Registra"}
        </Button>
      </div>
    </form>
  );
}

// ============================================================================
// RN-47 Report mensile ristoratori
// ============================================================================

function MonthlyReportCard({ partnerId }: { partnerId: string }) {
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<MonthlyPartnerReport | null>(null);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = () => {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const r = await generateMonthlyReportAction({ partnerId });
      if (r.ok) {
        setReport(r.report);
        setMessage(r.message);
      } else {
        setError(r.error);
      }
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileBarChart className="h-4 w-4 text-primary" />
          <h3 className="font-serif font-semibold">Report mensile (RN-47)</h3>
        </div>
        {!report && (
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={pending}
            className="bg-primary text-white hover:bg-primary-hover"
          >
            {pending ? "Preparo..." : "Genera report"}
          </Button>
        )}
      </div>

      {!report && !error && (
        <p className="text-xs text-text-muted">
          Prepara un messaggio da inviare al ristoratore: andamento ordini, posizione nella
          categoria, attivita&apos; recenti. In F1 si copia e si manda via WhatsApp a mano (M05
          Twilio non ancora configurato).
        </p>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      {report && (
        <>
          <div className="rounded-md border border-border bg-bg p-3 text-xs">
            <div className="mb-2 font-medium text-text">
              {report.monthLabel.charAt(0).toUpperCase() + report.monthLabel.slice(1)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-text-muted">Ordini</div>
                <div className="text-base font-semibold">
                  {report.ordersThisMonth}
                  {report.ordersDeltaPct !== null && (
                    <span
                      className={`ml-1 text-xs ${
                        report.ordersDeltaPct >= 0 ? "text-success" : "text-danger"
                      }`}
                    >
                      ({report.ordersDeltaPct >= 0 ? "+" : ""}
                      {report.ordersDeltaPct}%)
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-text-muted">
                  vs {report.ordersPrevMonth} mese prec.
                </div>
              </div>
              <div>
                <div className="text-text-muted">Attivita&apos; M07</div>
                <div className="text-base font-semibold">{report.activitiesCount}</div>
                <div className="text-[10px] text-text-muted">
                  vs {report.activitiesPrevCount} mese prec.
                </div>
              </div>
              {report.categoryMedianOrders !== null && (
                <div>
                  <div className="text-text-muted">Media categoria</div>
                  <div className="text-base font-semibold">
                    {report.categoryMedianOrders.toFixed(0)}
                  </div>
                  <div
                    className={`text-[10px] ${
                      report.positionVsCategory === "above"
                        ? "text-success"
                        : report.positionVsCategory === "below"
                          ? "text-danger"
                          : "text-text-muted"
                    }`}
                  >
                    {report.positionVsCategory === "above"
                      ? "Sopra la media"
                      : report.positionVsCategory === "below"
                        ? "Sotto la media"
                        : report.positionVsCategory === "in_line"
                          ? "In linea"
                          : "N/D"}
                  </div>
                </div>
              )}
              <div>
                <div className="text-text-muted">Voucher attivi</div>
                <div className="text-base font-semibold">{report.activeVouchersForBrand}</div>
                <div className="text-[10px] text-text-muted">spendibili qui</div>
              </div>
            </div>
            {report.ordersThisMonth === 0 && (
              <div className="mt-2 border-t border-border/60 pt-2 text-[10px] italic text-text-muted">
                Nessun ordine attribuito al ristorante: i connettori M1 reali non sono ancora
                attivi, quindi il messaggio parla di relazione invece che di numeri.
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="report-msg" className="text-xs">
              Messaggio pronto per WhatsApp
            </Label>
            <Textarea
              id="report-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="mt-1 text-xs"
            />
            <div className="mt-2 flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setReport(null);
                  setMessage("");
                }}
              >
                Rigenera
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCopy}
                className="bg-primary text-white hover:bg-primary-hover"
              >
                {copied ? (
                  <>
                    <CheckIcon className="mr-1 h-3 w-3" /> Copiato
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3 w-3" /> Copia testo
                  </>
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// ============================================================================
// RN-48 Fase di lancio nuovo ristorante
// ============================================================================

function LaunchCard({ partnerId, canCrud }: { partnerId: string; canCrud: boolean }) {
  const [status, setStatus] = useState<PartnerLaunchStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let aborted = false;
    (async () => {
      setLoading(true);
      const r = await getLaunchStatusAction(partnerId);
      if (!aborted) {
        if (r.ok) {
          setStatus(r.status);
          setNotes(r.status.reviewNotes ?? "");
        }
        setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [partnerId]);

  if (loading) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4 text-xs italic text-text-muted">
        Caricamento stato lancio...
      </section>
    );
  }
  if (!status || !status.launchedAtIso) {
    // Partner mai andato attivo: non mostriamo la card. Comparira' quando l'Owner
    // porta il partner in stato "attivo" dal form.
    return null;
  }

  const launchedAt = new Date(status.launchedAtIso);
  const progressPct = Math.min(100, Math.round((status.dayNum / LAUNCH_WINDOW_DAYS) * 100));
  const target =
    status.targetOrders ??
    (status.categoryMedianAtWindow !== null ? Math.round(status.categoryMedianAtWindow) : null);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    const r = await updateLaunchNotesAction({ partnerId, notes });
    setSavingNotes(false);
    if (r.ok) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          <h3 className="font-serif font-semibold">
            {status.inLaunch ? "Fase di lancio (RN-48)" : "Lancio concluso"}
          </h3>
        </div>
        {status.underSurveillance && status.inLaunch && (
          <Badge className="border border-warning/40 bg-warning/15 text-warning">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Sotto media
          </Badge>
        )}
      </div>

      <div className="rounded-md border border-border bg-bg p-3 text-xs">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-text-muted">
            Partito il{" "}
            {launchedAt.toLocaleDateString("it-IT", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span className="font-semibold text-text">
            Giorno {status.dayNum}/{LAUNCH_WINDOW_DAYS}
            {status.inLaunch && (
              <span className="ml-1 font-normal text-text-muted">
                ({status.daysRemaining}gg rimasti)
              </span>
            )}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div
            className={`h-full transition-all ${
              status.underSurveillance ? "bg-warning" : "bg-primary"
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <div className="text-text-muted">Ordini finora</div>
            <div className="text-base font-semibold">{status.ordersSoFar}</div>
            {target !== null && (
              <div className="text-[10px] text-text-muted">
                target {target} in {LAUNCH_WINDOW_DAYS}gg
              </div>
            )}
          </div>
          <div>
            <div className="text-text-muted">Mediana categoria</div>
            <div className="text-base font-semibold">
              {status.categoryMedianAtWindow !== null
                ? status.categoryMedianAtWindow.toFixed(0)
                : "N/D"}
            </div>
            <div className="text-[10px] text-text-muted">nei primi {LAUNCH_WINDOW_DAYS}gg</div>
          </div>
        </div>
        {status.ordersSoFar === 0 && (
          <div className="mt-2 border-t border-border/60 pt-2 text-[10px] italic text-text-muted">
            Nessun ordine attribuito: senza connettori M1 reali attivi i dati vendita non arrivano.
            La sorveglianza automatica non puo&apos; agire.
          </div>
        )}
      </div>

      {canCrud && (
        <div>
          <Label htmlFor="launch-notes" className="text-xs">
            Note di lancio
          </Label>
          <Textarea
            id="launch-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Es. 'Prima settimana ok ma meno ordini del previsto, chiamarlo lunedi' "
            className="mt-1 text-xs"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            {justSaved && (
              <span className="text-[10px] text-success">
                <CheckIcon className="mr-0.5 inline h-3 w-3" />
                Salvate
              </span>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSaveNotes}
              disabled={savingNotes}
              className="ml-auto"
            >
              {savingNotes ? "Salvo..." : "Salva note"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================================
// RN-28 Errori consegna ristorante
// ============================================================================

function DeliveryErrorsCard({ partnerId, canCrud }: { partnerId: string; canCrud: boolean }) {
  const [summary, setSummary] = useState<PartnerErrorsSummary | null>(null);
  const [recent, setRecent] = useState<DeliveryError[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reload, setReload] = useState(0);

  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState<DeliveryErrorSeverity>("media");
  const [compensationVoucherId, setCompensationVoucherId] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      setLoading(true);
      const r = await getPartnerErrorsAction(partnerId);
      if (!aborted) {
        if (r.ok) {
          setSummary(r.summary);
          setRecent(r.recent);
        }
        setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [partnerId, reload]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (reason.trim().length < 3) {
      setFormError("Scrivi almeno 3 caratteri per il motivo");
      return;
    }
    startTransition(async () => {
      const payload: Parameters<typeof recordDeliveryErrorAction>[0] = {
        partnerId,
        reason,
        severity,
      };
      if (compensationVoucherId.trim()) {
        payload.compensationVoucherId = compensationVoucherId.trim();
      }
      if (notes.trim()) payload.notes = notes.trim();
      const r = await recordDeliveryErrorAction(payload);
      if (r.ok) {
        setFormOpen(false);
        setReason("");
        setSeverity("media");
        setCompensationVoucherId("");
        setNotes("");
        setReload((n) => n + 1);
      } else {
        setFormError(r.error);
      }
    });
  };

  if (loading) {
    return (
      <section className="rounded-lg border border-border bg-surface p-4 text-xs italic text-text-muted">
        Caricamento errori...
      </section>
    );
  }

  const alertBg =
    summary?.alertLevel === "alert"
      ? "border-danger/40 bg-danger/5"
      : summary?.alertLevel === "warn"
        ? "border-warning/40 bg-warning/5"
        : "border-border bg-surface";

  return (
    <section className={`space-y-3 rounded-lg border p-4 text-sm ${alertBg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PackageX
            className={`h-4 w-4 ${
              summary?.alertLevel === "alert"
                ? "text-danger"
                : summary?.alertLevel === "warn"
                  ? "text-warning"
                  : "text-primary"
            }`}
          />
          <h3 className="font-serif font-semibold">Errori consegna (RN-28)</h3>
          {summary?.alertLevel === "alert" && (
            <Badge className="border border-danger/40 bg-danger/15 text-danger">Allarme</Badge>
          )}
          {summary?.alertLevel === "warn" && (
            <Badge className="border border-warning/40 bg-warning/15 text-warning">
              Attenzione
            </Badge>
          )}
        </div>
        {canCrud && !formOpen && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setFormOpen(true)}
            className="border-danger/40 text-danger hover:bg-danger/10"
          >
            <PlusIcon className="mr-1 h-3 w-3" />
            Registra errore
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-bg p-3 text-xs">
        <div>
          <div className="text-text-muted">Ultimi 30 giorni</div>
          <div className="text-xl font-semibold">{summary?.countLast30d ?? 0}</div>
          <div className="text-[10px] text-text-muted">
            {summary && summary.countLast30d >= 3
              ? "Soglia allarme: >= 3"
              : summary?.countLast30d === 2
                ? "Attenzione: 2 (prossimi all'allarme)"
                : "Fisiologico (0-1/mese)"}
          </div>
        </div>
        <div>
          <div className="text-text-muted">30 giorni precedenti</div>
          <div className="text-xl font-semibold">{summary?.countPrevious30d ?? 0}</div>
          <div className="text-[10px] text-text-muted">per confronto</div>
        </div>
      </div>

      {formOpen && canCrud && (
        <form
          onSubmit={handleSubmit}
          className="space-y-2 rounded-md border border-danger/30 bg-danger/5 p-3"
        >
          <div>
            <Label htmlFor="err-reason" className="text-xs">
              Motivo errore
            </Label>
            <Input
              id="err-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Es. ordine consegnato con 45 min di ritardo"
              maxLength={500}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="err-sev" className="text-xs">
                Gravita
              </Label>
              <select
                id="err-sev"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as DeliveryErrorSeverity)}
                className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
              >
                {(Object.keys(SEVERITY_LABELS) as DeliveryErrorSeverity[]).map((s) => (
                  <option key={s} value={s}>
                    {SEVERITY_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="err-voucher" className="text-xs">
                Voucher scuse (ID, opzionale)
              </Label>
              <Input
                id="err-voucher"
                value={compensationVoucherId}
                onChange={(e) => setCompensationVoucherId(e.target.value)}
                placeholder="UUID voucher"
                maxLength={40}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="err-notes" className="text-xs">
              Note (opzionale)
            </Label>
            <Textarea
              id="err-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>
          {formError && <p className="text-xs text-danger">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFormOpen(false);
                setFormError(null);
              }}
            >
              Annulla
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              className="bg-danger text-white hover:bg-danger/80"
            >
              {pending ? "Registro..." : "Registra errore"}
            </Button>
          </div>
        </form>
      )}

      {recent.length > 0 && (
        <div className="rounded-md border border-border bg-bg p-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Ultimi {recent.length} errori
          </div>
          <ul className="space-y-1">
            {recent.map((err) => (
              <li key={err.id} className="rounded px-1 py-1 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-text-muted">
                    {new Date(err.occurredAt).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </span>
                  <Badge className={`border text-[10px] ${SEVERITY_STYLES[err.severity]}`}>
                    {SEVERITY_LABELS[err.severity]}
                  </Badge>
                </div>
                <div className="text-text">{err.reason}</div>
                {err.compensationVoucherId && (
                  <div className="text-[10px] text-text-muted">
                    Voucher scuse: {err.compensationVoucherId.slice(0, 8)}…
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
