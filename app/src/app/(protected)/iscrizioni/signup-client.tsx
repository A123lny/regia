"use client";

// Client per admin iscrizioni: 2 tab (Landing / Eventi) con dialog CRUD.

import { useState, useTransition } from "react";
import { Plus, Link as LinkIcon, ExternalLink, Copy, CheckCircle2, QrCode } from "lucide-react";
import { QrDialog } from "./qr-dialog";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  upsertLandingAction,
  archiveLandingAction,
  AUDIENCE_KIND_LABELS,
  CONSENT_CHANNEL_LABELS,
} from "@/modules/m10-signup/public";
import type { ConsentChannel, EventRow, LandingRow } from "@/modules/m10-signup/public";

type BrandOpt = { id: string; slug: string; displayName: string; color: string };
type OfferOpt = { id: string; name: string; brandId: string };

type Props = {
  landings: LandingRow[];
  events: EventRow[];
  brands: BrandOpt[];
  offers: OfferOpt[];
  canCrud: boolean;
};

type Tab = "landing" | "eventi";

export function SignupClient({ landings, events, brands, offers, canCrud }: Props) {
  const [tab, setTab] = useState<Tab>("landing");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        <TabButton active={tab === "landing"} onClick={() => setTab("landing")}>
          Landing ({landings.length})
        </TabButton>
        <TabButton active={tab === "eventi"} onClick={() => setTab("eventi")}>
          Eventi ({events.length})
        </TabButton>
      </div>

      {tab === "landing" && (
        <LandingsTab landings={landings} brands={brands} offers={offers} canCrud={canCrud} />
      )}
      {tab === "eventi" && <EventsTab events={events} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// LANDINGS TAB
// ============================================================================

function LandingsTab({
  landings,
  brands,
  offers,
  canCrud,
}: {
  landings: LandingRow[];
  brands: BrandOpt[];
  offers: OfferOpt[];
  canCrud: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LandingRow | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [qrFor, setQrFor] = useState<{ slug: string; headline: string } | null>(null);
  const [pending, startTransition] = useTransition();

  async function copyUrl(slug: string) {
    const url = `${window.location.origin}/iscriviti/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 2000);
    } catch {
      // No-op
    }
  }

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
                <Plus className="mr-2 h-4 w-4" /> Nuova landing
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
              <SheetHeader>
                <SheetTitle className="font-serif">
                  {editing ? "Modifica landing" : "Nuova landing"}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 pb-8">
                <LandingForm
                  brands={brands}
                  offers={offers}
                  initial={editing}
                  onDone={(created) => {
                    const wasCreate = !editing;
                    setDialogOpen(false);
                    setEditing(null);
                    // Al termine di una CREAZIONE riuscita apro automaticamente
                    // il QR dialog cosi' l'utente puo' scaricare subito il QR.
                    if (wasCreate && created) {
                      setQrFor({ slug: created.slug, headline: created.headline });
                    }
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {landings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessuna landing configurata.
          {canCrud && " Crea la prima con il bottone in alto."}
        </div>
      ) : (
        <div className="space-y-2">
          {landings.map((l) => (
            <div key={l.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <BrandChip slug={l.brandSlug} name={l.brandDisplayName} color={l.brandColor} />
                    <h3 className="font-medium text-text">{l.headline}</h3>
                    {!l.isActive && (
                      <Badge className="border border-border bg-surface-muted text-text-muted">
                        Sospesa
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-text-muted">{l.benefitHeadline}</div>
                </div>
                {canCrud && (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(l);
                        setDialogOpen(true);
                      }}
                    >
                      Modifica
                    </Button>
                    {l.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        className="border-danger/40 text-danger hover:bg-danger/10"
                        onClick={() => {
                          startTransition(async () => {
                            await archiveLandingAction(l.id);
                          });
                        }}
                      >
                        Sospendi
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-bg p-2 text-xs">
                <LinkIcon className="h-3.5 w-3.5 text-text-muted" />
                <code className="text-text-muted">/iscriviti/{l.slug}</code>
                <button
                  type="button"
                  onClick={() => copyUrl(l.slug)}
                  className="ml-auto rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-text"
                  aria-label="Copia URL"
                  title="Copia URL"
                >
                  {copiedSlug === l.slug ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <a
                  href={`/iscriviti/${l.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-text"
                  aria-label="Apri landing"
                  title="Apri in nuova scheda"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setQrFor({ slug: l.slug, headline: l.headline })}
                  className="rounded-md p-1 text-text-muted hover:bg-primary/10 hover:text-primary"
                  aria-label="Mostra QR code"
                  title="Mostra QR code"
                >
                  <QrCode className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {qrFor && (
        <QrDialog slug={qrFor.slug} headline={qrFor.headline} onClose={() => setQrFor(null)} />
      )}
    </div>
  );
}

function LandingForm({
  brands,
  offers,
  initial,
  onDone,
}: {
  brands: BrandOpt[];
  offers: OfferOpt[];
  initial: LandingRow | null;
  onDone: (created?: { slug: string; headline: string }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(initial?.brandId ?? brands[0]?.id ?? "");
  const [hasAudienceQuestion, setHasAudienceQuestion] = useState(
    initial?.audiencePrompt !== null && initial?.audiencePrompt !== undefined,
  );
  const brandOffers = offers.filter((o) => o.brandId === brandId);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const payload: Parameters<typeof upsertLandingAction>[0] = {
            brandId,
            slug: String(fd.get("slug") ?? ""),
            headline: String(fd.get("headline") ?? ""),
            benefitHeadline: String(fd.get("benefitHeadline") ?? ""),
            isActive: fd.get("isActive") === "on",
          };
          if (initial) payload.landingId = initial.id;
          const sub = String(fd.get("subheadline") ?? "").trim();
          if (sub) payload.subheadline = sub;
          if (hasAudienceQuestion) {
            const prompt = String(fd.get("audiencePrompt") ?? "").trim();
            if (prompt) payload.audiencePrompt = prompt;
            const resLabel = String(fd.get("audienceResidenteLabel") ?? "").trim();
            if (resLabel) payload.audienceResidenteLabel = resLabel;
            const turLabel = String(fd.get("audienceTuristaLabel") ?? "").trim();
            if (turLabel) payload.audienceTuristaLabel = turLabel;
          }
          const offerId = String(fd.get("welcomeOfferId") ?? "").trim();
          if (offerId) payload.welcomeOfferId = offerId;

          const result = await upsertLandingAction(payload);
          if (result.ok) {
            onDone({ slug: result.slug, headline: payload.headline });
          } else setError(result.error);
        });
      }}
      className="space-y-3"
    >
      <div>
        <Label htmlFor="brandId">Marchio</Label>
        <select
          id="brandId"
          value={brandId}
          onChange={(e) => setBrandId(e.target.value)}
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
        <Label htmlFor="slug">Slug URL</Label>
        <Input
          id="slug"
          name="slug"
          required
          maxLength={64}
          defaultValue={initial?.slug ?? ""}
          placeholder="es. bar-eni-cafe"
          pattern="[a-z0-9][a-z0-9-]{1,63}"
        />
        <p className="mt-1 text-[11px] text-text-muted">
          Lettere minuscole, cifre, trattini. URL finale: /iscriviti/&lt;slug&gt;
        </p>
      </div>
      <div>
        <Label htmlFor="headline">Titolo</Label>
        <Input
          id="headline"
          name="headline"
          required
          maxLength={100}
          defaultValue={initial?.headline ?? ""}
          placeholder="es. Iscriviti al bar Eni Cafè"
        />
      </div>
      <div>
        <Label htmlFor="subheadline">Sottotitolo (opzionale)</Label>
        <Input
          id="subheadline"
          name="subheadline"
          maxLength={200}
          defaultValue={initial?.subheadline ?? ""}
        />
      </div>
      <div>
        <Label htmlFor="benefitHeadline">Cosa ricevi (benefit)</Label>
        <Input
          id="benefitHeadline"
          name="benefitHeadline"
          required
          maxLength={200}
          defaultValue={initial?.benefitHeadline ?? ""}
          placeholder="es. Un caffè omaggio al prossimo pieno"
        />
      </div>

      <div>
        <Label htmlFor="welcomeOfferId">Voucher benvenuto (opzionale)</Label>
        <select
          id="welcomeOfferId"
          name="welcomeOfferId"
          defaultValue={initial?.welcomeOfferId ?? ""}
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          <option value="">— nessun voucher —</option>
          {brandOffers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-text-muted">
          Se selezionato, ogni iscritto riceve un voucher al momento dell&apos;iscrizione.
        </p>
      </div>

      <div className="rounded-md border border-border bg-bg p-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasAudienceQuestion}
            onChange={(e) => setHasAudienceQuestion(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Chiedi &quot;residente vs turista&quot; (RF-10.2)
        </label>
        {hasAudienceQuestion && (
          <div className="mt-2 space-y-2">
            <Input
              name="audiencePrompt"
              defaultValue={initial?.audiencePrompt ?? "Sei residente o di passaggio?"}
              placeholder="Domanda"
              required={hasAudienceQuestion}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                name="audienceResidenteLabel"
                defaultValue={initial?.audienceResidenteLabel ?? "Residente / pendolare"}
                placeholder="Opzione residente"
              />
              <Input
                name="audienceTuristaLabel"
                defaultValue={initial?.audienceTuristaLabel ?? "Di passaggio"}
                placeholder="Opzione turista"
              />
            </div>
          </div>
        )}
      </div>

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
        <Button type="button" variant="outline" onClick={() => onDone()}>
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
// EVENTS TAB
// ============================================================================

function EventsTab({ events }: { events: EventRow[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
        Nessun evento di iscrizione ancora.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
          <tr>
            <th className="w-40 p-3">Quando</th>
            <th className="p-3">Contatto</th>
            <th className="p-3">Landing</th>
            <th className="w-24 p-3">Audience</th>
            <th className="p-3">Canali</th>
            <th className="w-24 p-3">Voucher</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-border/60 last:border-0">
              <td className="p-3 text-xs text-text-muted">
                {new Date(e.occurredAt).toLocaleString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="p-3 text-xs">
                {e.contactFullName ?? <span className="italic text-text-muted">senza nome</span>}
                {e.contactEmail && <div className="text-text-muted">{e.contactEmail}</div>}
              </td>
              <td className="p-3 text-xs">
                {e.landingSlug ? (
                  <div>
                    <code className="rounded bg-surface-muted px-1 py-0.5">/{e.landingSlug}</code>
                    {e.landingHeadline && (
                      <div className="mt-0.5 text-text-muted">{e.landingHeadline}</div>
                    )}
                  </div>
                ) : (
                  <span className="italic text-text-muted">—</span>
                )}
              </td>
              <td className="p-3 text-xs text-text-muted">
                {e.audienceKind ? AUDIENCE_KIND_LABELS[e.audienceKind] : "—"}
              </td>
              <td className="p-3">
                <div className="flex flex-wrap gap-1">
                  {e.channelsGranted.length === 0 ? (
                    <span className="text-xs italic text-text-muted">—</span>
                  ) : (
                    e.channelsGranted.map((ch: ConsentChannel) => (
                      <span
                        key={ch}
                        className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary"
                      >
                        {CONSENT_CHANNEL_LABELS[ch]}
                      </span>
                    ))
                  )}
                </div>
              </td>
              <td className="p-3 text-xs">
                {e.welcomeVoucherId ? (
                  <Badge className="border border-success/40 bg-success/15 text-success">✓</Badge>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
