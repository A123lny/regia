"use client";

// Client per campagne: lista + form CRUD + marker "inviata" con contatori.

import { useState, useTransition } from "react";
import { Plus, Send, X as XIcon, CheckCircle2, Rocket } from "lucide-react";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  upsertCampaignAction,
  markCampaignSentAction,
  cancelCampaignAction,
  previewCampaignRecipientsAction,
  sendCampaignTestAction,
  launchCampaignAction,
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_STATUS_LABELS,
} from "@/modules/m07-outreach/public";
import type {
  CampaignChannel,
  CampaignRow,
  CampaignStatus,
  SegmentRow,
  CampaignPreview,
} from "@/modules/m07-outreach/public";

type BrandOpt = { id: string; slug: string; displayName: string; color: string };

type Props = {
  campaigns: CampaignRow[];
  segments: SegmentRow[];
  brands: BrandOpt[];
  canCrud: boolean;
  canMarkSent: boolean;
};

const STATUS_STYLE: Record<CampaignStatus, string> = {
  draft: "border-border bg-surface-muted text-text-muted",
  scheduled: "border-primary/40 bg-primary/15 text-primary",
  sending: "border-primary/60 bg-primary/20 text-primary",
  sent: "border-success/40 bg-success/15 text-success",
  cancelled: "border-danger/40 bg-danger/15 text-danger",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CampaignsClient({ campaigns, segments, brands, canCrud, canMarkSent }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [markingSent, setMarkingSent] = useState<CampaignRow | null>(null);
  const [launching, setLaunching] = useState<CampaignRow | null>(null);
  const [pending, startTransition] = useTransition();

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
                <Plus className="mr-2 h-4 w-4" /> Nuova campagna
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
              <SheetHeader>
                <SheetTitle className="font-serif">
                  {editing ? "Modifica campagna" : "Nuova campagna"}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 px-4 pb-8">
                <CampaignForm
                  brands={brands}
                  segments={segments}
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

      {campaigns.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center text-sm text-text-muted">
          Nessuna campagna configurata.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="w-28 p-3">Marchio</th>
                <th className="p-3">Campagna</th>
                <th className="w-32 p-3">Segmento</th>
                <th className="w-24 p-3">Canale</th>
                <th className="w-32 p-3">Programmata</th>
                <th className="p-3 text-center">Esiti</th>
                <th className="w-28 p-3">Stato</th>
                <th className="w-20 p-3" />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border/60 last:border-0 hover:bg-surface-muted"
                >
                  <td className="p-3">
                    <BrandChip slug={c.brandSlug} name={c.brandDisplayName} color={c.brandColor} />
                  </td>
                  <td className="p-3">
                    <div
                      className={canCrud && c.status !== "sent" ? "cursor-pointer" : ""}
                      onClick={() => {
                        if (canCrud && c.status !== "sent") {
                          setEditing(c);
                          setDialogOpen(true);
                        }
                      }}
                    >
                      <div className="font-medium text-text">{c.name}</div>
                      {c.notes && <div className="text-xs text-text-muted">{c.notes}</div>}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-text-muted">
                    {c.segmentName ?? <span className="italic">— senza segmento —</span>}
                  </td>
                  <td className="p-3 text-xs text-text-muted">
                    {CAMPAIGN_CHANNEL_LABELS[c.channel]}
                  </td>
                  <td className="p-3 text-xs text-text-muted">{formatDate(c.plannedAt)}</td>
                  <td className="p-3 text-center text-xs">
                    {c.status === "sent" ? (
                      <div className="text-text-muted">
                        <span className="text-success">{c.deliveredCount}</span>/
                        <span>{c.attemptedCount}</span>
                        {c.failedCount > 0 && (
                          <span className="ml-1 text-danger">·{c.failedCount} fail</span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3">
                    <Badge className={`border ${STATUS_STYLE[c.status]}`}>
                      {CAMPAIGN_STATUS_LABELS[c.status]}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      {canCrud &&
                        c.channel === "email" &&
                        (c.status === "draft" || c.status === "scheduled") && (
                          <button
                            type="button"
                            onClick={() => setLaunching(c)}
                            className="rounded-md p-1 text-text-muted hover:bg-primary/10 hover:text-primary"
                            aria-label="Lancia campagna via M05 (RN-62)"
                            title="Lancia campagna via M05 (preview + test + partenza scaglionata)"
                          >
                            <Rocket className="h-3.5 w-3.5" />
                          </button>
                        )}
                      {canMarkSent && (c.status === "draft" || c.status === "scheduled") && (
                        <button
                          type="button"
                          onClick={() => setMarkingSent(c)}
                          className="rounded-md p-1 text-text-muted hover:bg-success/10 hover:text-success"
                          aria-label="Marca inviata manualmente"
                          title="Marca come inviata (manuale, senza M05)"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canCrud && (c.status === "draft" || c.status === "scheduled") && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              await cancelCampaignAction(c.id);
                            });
                          }}
                          className="rounded-md p-1 text-text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                          aria-label="Annulla campagna"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog "marca inviata" */}
      <Sheet open={markingSent !== null} onOpenChange={(o) => !o && setMarkingSent(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-serif">Marca campagna come inviata</SheetTitle>
          </SheetHeader>
          {markingSent && (
            <div className="mt-4 px-4 pb-8">
              <MarkSentForm campaign={markingSent} onDone={() => setMarkingSent(null)} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog "Lancia campagna RN-62" (3 step: preview → test → launch) */}
      <Sheet open={launching !== null} onOpenChange={(o) => !o && setLaunching(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-serif">Lancia campagna via M05 (RN-62)</SheetTitle>
          </SheetHeader>
          {launching && (
            <div className="mt-4 px-4 pb-8">
              <RN62LaunchForm campaign={launching} onDone={() => setLaunching(null)} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ============================================================================
// RN-62 Launch form: 3 step preview → test → confirm count → launch
// ============================================================================

function RN62LaunchForm({ campaign, onDone }: { campaign: CampaignRow; onDone: () => void }) {
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [confirmNumber, setConfirmNumber] = useState("");
  const [launchStatus, setLaunchStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadPreview() {
    setLoadingPreview(true);
    setPreviewError(null);
    startTransition(async () => {
      const res = await previewCampaignRecipientsAction(campaign.id);
      setLoadingPreview(false);
      if (res.ok) setPreview(res.preview);
      else setPreviewError(res.error);
    });
  }

  function sendTest() {
    if (!testEmail) return;
    setTestStatus(null);
    startTransition(async () => {
      const res = await sendCampaignTestAction({
        campaignId: campaign.id,
        recipientEmail: testEmail,
      });
      setTestStatus(
        res.ok ? `Prova accodata (job ${res.jobId.slice(0, 8)}…)` : `Errore: ${res.error}`,
      );
    });
  }

  function launch() {
    const num = Number(confirmNumber);
    if (!Number.isFinite(num)) {
      setLaunchStatus("Devi digitare il numero esatto dei destinatari");
      return;
    }
    setLaunchStatus(null);
    startTransition(async () => {
      const res = await launchCampaignAction({
        campaignId: campaign.id,
        confirmedCount: num,
      });
      if (res.ok) {
        setLaunchStatus(
          `Lanciata! ${res.enqueued} accodati, ${res.skipped} saltati${res.errors.length > 0 ? `, ${res.errors.length} errori` : ""}.`,
        );
        setTimeout(onDone, 2500);
      } else {
        setLaunchStatus(`Errore: ${(res as { error: string }).error}`);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md bg-surface-muted p-3 text-sm">
        <strong>Campagna:</strong> {campaign.name}
        <br />
        <strong>Canale:</strong> {campaign.channel} · <strong>Marchio:</strong>{" "}
        {campaign.brandDisplayName}
      </div>

      {/* STEP 1 — Preview */}
      <section className="space-y-2">
        <h3 className="font-semibold">1 · Anteprima destinatari</h3>
        {!preview && (
          <Button
            type="button"
            variant="outline"
            disabled={pending || loadingPreview}
            onClick={loadPreview}
          >
            {loadingPreview ? "Carico…" : "Carica anteprima"}
          </Button>
        )}
        {previewError && <p className="text-sm text-danger">{previewError}</p>}
        {preview && (
          <div className="space-y-2 text-sm">
            <div>
              <strong>Destinatari totali:</strong> {preview.totalRecipients}
            </div>
            <div>
              <strong>Segmento:</strong> {preview.segmentName}
            </div>
            <div>
              <strong>Oggetto:</strong> {preview.resolvedSubject}
            </div>
            <div className="rounded border bg-surface-muted p-2 text-xs">
              {preview.resolvedBody.slice(0, 200)}
              {preview.resolvedBody.length > 200 ? "…" : ""}
            </div>
            <div>
              <strong>Esempi (3 destinatari):</strong>
              <ul className="list-disc pl-5">
                {preview.sampleContacts.map((c) => (
                  <li key={c.id}>
                    {c.fullName ?? "(senza nome)"} — {c.email ?? c.phone ?? "nessun recapito"}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* STEP 2 — Test */}
      {preview && (
        <section className="space-y-2">
          <h3 className="font-semibold">2 · Invio di prova</h3>
          <p className="text-sm text-text-muted">
            Invia a te stesso per vedere come appare prima della partenza reale.
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="tua@email.it"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              disabled={pending}
            />
            <Button
              type="button"
              variant="outline"
              disabled={pending || !testEmail}
              onClick={sendTest}
            >
              Invia prova
            </Button>
          </div>
          {testStatus && <p className="text-sm">{testStatus}</p>}
        </section>
      )}

      {/* STEP 3 — Launch con conferma */}
      {preview && (
        <section className="space-y-2 rounded-md border-2 border-danger/40 p-3">
          <h3 className="font-semibold text-danger">3 · Partenza (irreversibile)</h3>
          <p className="text-sm text-text-muted">
            Digita <strong>{preview.totalRecipients}</strong> per confermare. La campagna partirà
            scaglionata (primi 100, pausa 10min, poi resto).
          </p>
          <Input
            type="number"
            placeholder={String(preview.totalRecipients)}
            value={confirmNumber}
            onChange={(e) => setConfirmNumber(e.target.value)}
            disabled={pending}
          />
          <Button
            type="button"
            variant="destructive"
            disabled={pending || Number(confirmNumber) !== preview.totalRecipients}
            onClick={launch}
          >
            Lancia ora
          </Button>
          {launchStatus && <p className="text-sm">{launchStatus}</p>}
        </section>
      )}

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={onDone}>
          Chiudi
        </Button>
      </div>
    </div>
  );
}

function CampaignForm({
  brands,
  segments,
  initial,
  onDone,
}: {
  brands: BrandOpt[];
  segments: SegmentRow[];
  initial: CampaignRow | null;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(initial?.brandId ?? brands[0]?.id ?? "");
  const brandSegments = segments.filter((s) => s.brandId === brandId);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const payload: Parameters<typeof upsertCampaignAction>[0] = {
            brandId,
            name: String(fd.get("name") ?? ""),
            channel: String(fd.get("channel") ?? "email") as CampaignChannel,
          };
          if (initial) payload.campaignId = initial.id;
          const segId = String(fd.get("segmentId") ?? "").trim();
          if (segId) payload.segmentId = segId;
          const planned = String(fd.get("plannedAt") ?? "").trim();
          if (planned) payload.plannedAt = new Date(planned).toISOString();
          const notes = String(fd.get("notes") ?? "").trim();
          if (notes) payload.notes = notes;

          const result = await upsertCampaignAction(payload);
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
        <Label htmlFor="name">Nome campagna</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          defaultValue={initial?.name ?? ""}
          placeholder="es. Riattivazione dormienti Novembre"
        />
      </div>
      <div>
        <Label htmlFor="segmentId">Segmento</Label>
        <select
          id="segmentId"
          name="segmentId"
          defaultValue={initial?.segmentId ?? ""}
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          <option value="">— senza segmento (definisci in seguito) —</option>
          {brandSegments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.contactCountMaterialized} contatti)
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="channel">Canale</Label>
        <select
          id="channel"
          name="channel"
          defaultValue={initial?.channel ?? "email"}
          className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
        >
          {(Object.keys(CAMPAIGN_CHANNEL_LABELS) as CampaignChannel[]).map((c) => (
            <option key={c} value={c}>
              {CAMPAIGN_CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="plannedAt">Programmato per (opzionale)</Label>
        <Input
          id="plannedAt"
          name="plannedAt"
          type="datetime-local"
          defaultValue={
            initial?.plannedAt ? new Date(initial.plannedAt).toISOString().slice(0, 16) : ""
          }
        />
      </div>
      <div>
        <Label htmlFor="notes">Note</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
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

function MarkSentForm({ campaign, onDone }: { campaign: CampaignRow; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const payload: Parameters<typeof markCampaignSentAction>[0] = {
            campaignId: campaign.id,
            attempted: parseInt(String(fd.get("attempted") ?? "0"), 10),
            delivered: parseInt(String(fd.get("delivered") ?? "0"), 10),
            failed: parseInt(String(fd.get("failed") ?? "0"), 10),
          };
          const notes = String(fd.get("notes") ?? "").trim();
          if (notes) payload.notes = notes;

          const result = await markCampaignSentAction(payload);
          if (result.ok) onDone();
          else setError(result.error);
        });
      }}
      className="space-y-3"
    >
      <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
        <div className="font-medium text-text">{campaign.name}</div>
        <div className="text-xs text-text-muted">
          {CAMPAIGN_CHANNEL_LABELS[campaign.channel]}
          {campaign.segmentName && ` · ${campaign.segmentName}`}
        </div>
      </div>
      <p className="text-xs text-text-muted">
        Segna gli esiti dell&apos;invio manuale. Fino a M5 il sistema non tiene traccia
        automaticamente; questo passaggio serve per l&apos;audit trail.
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label htmlFor="attempted" className="text-xs">
            Tentati
          </Label>
          <Input id="attempted" name="attempted" type="number" min={0} required defaultValue={0} />
        </div>
        <div>
          <Label htmlFor="delivered" className="text-xs">
            Consegnati
          </Label>
          <Input id="delivered" name="delivered" type="number" min={0} required defaultValue={0} />
        </div>
        <div>
          <Label htmlFor="failed" className="text-xs">
            Falliti
          </Label>
          <Input id="failed" name="failed" type="number" min={0} required defaultValue={0} />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Note</Label>
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
          className="bg-success text-white hover:bg-success/90"
        >
          <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
          {pending ? "Salvo..." : "Marca inviata"}
        </Button>
      </div>
    </form>
  );
}
