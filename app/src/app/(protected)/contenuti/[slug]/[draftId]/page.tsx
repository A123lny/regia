import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getContentDraft,
  approveContentDraft,
  rejectContentDraft,
  unscheduleContentDraft,
  markContentDraftPublished,
} from "@/modules/m03-editorial/public";
import type { ContentDraftStatus } from "@/modules/m03-editorial/public";
import {
  getMediaAssetById,
  listMediaAssetsByBrand,
  listTemplatesForBrand,
} from "@/modules/m04-media/public";
import { getBrandBySlug } from "@/modules/m02-brand/public";
import { ScheduleDraftForm } from "./schedule-form";
import { MaterialRequestForm } from "./material-request-form";
import { DraftMediaPicker } from "./media-picker";
import { ChannelPreviews } from "./channel-previews";
import { SeoHintsCard } from "./seo-hints-card";
import { UtmPreviewCard } from "@/components/editorial/utm-preview-card";
import { TopicLabelEditor } from "@/components/editorial/topic-label-editor";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: ContentDraftStatus }) {
  if (status === "approved") {
    return <Badge className="border border-success/30 bg-success/15 text-success">Approvato</Badge>;
  }
  if (status === "rejected") {
    return <Badge className="border border-danger/30 bg-danger/15 text-danger">Rifiutato</Badge>;
  }
  if (status === "scheduled") {
    return (
      <Badge className="border border-primary/30 bg-primary/10 text-primary">Programmato</Badge>
    );
  }
  if (status === "published") {
    return (
      <Badge className="border border-text-muted/30 bg-text-muted/10 text-text-muted">
        Pubblicato
      </Badge>
    );
  }
  return <Badge className="border border-border bg-surface-muted text-text-muted">Bozza</Badge>;
}

export default async function DraftDetailPage({
  params,
}: {
  params: Promise<{ slug: string; draftId: string }>;
}) {
  const session = await getSessionOrRedirect();

  const { slug, draftId } = await params;
  const draft = await getContentDraft(draftId, session.organizationId);
  if (!draft) notFound();

  // Immagine allegata + libreria disponibile per il picker (RF-4.1)
  const [currentAsset, brand] = await Promise.all([
    draft.mediaAssetId
      ? getMediaAssetById(session.organizationId, draft.mediaAssetId)
      : Promise.resolve(null),
    getBrandBySlug(session.organizationId, slug),
  ]);
  const availableAssets = brand
    ? await listMediaAssetsByBrand(session.organizationId, brand.id, 200)
    : [];
  const availableTemplates = listTemplatesForBrand(slug);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <Link
          href={`/contenuti/${slug}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Contenuti
        </Link>
        <div className="flex items-center gap-3">
          <StatusBadge status={draft.status} />
          <h1 className="font-serif text-2xl font-semibold text-text">{draft.themeInput}</h1>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Post generato</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-surface-muted p-4 text-sm font-sans">
            {draft.generatedText}
          </pre>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-muted">
            <Badge variant="outline">Modello: {draft.modelUsed}</Badge>
            <Badge variant="outline">
              Tokens: {draft.tokensIn}→{draft.tokensOut}
            </Badge>
            <Badge variant="outline">Costo: ${draft.costUsd.toFixed(4)}</Badge>
            <Badge variant="outline">Latenza: {draft.latencyMs}ms</Badge>
            <Badge variant="outline">Prompt: {draft.promptVersion}</Badge>
            <Badge variant="outline">Data: {formatDateTime(draft.createdAt)}</Badge>
          </div>
          <div className="mt-4">
            <TopicLabelEditor
              draftId={draft.id}
              currentLabel={draft.topicLabel}
              disabled={draft.status === "published" || draft.status === "rejected"}
            />
          </div>
        </CardContent>
      </Card>

      {/* RF-13.7 Suggerimenti SEO organica (analizer euristico, zero AI) */}
      <SeoHintsCard text={draft.generatedText} />

      {/* RN-85 Anteprima link tracciati (compare solo se il testo contiene URL) */}
      <UtmPreviewCard text={draft.generatedText} brandSlug={slug} draftId={draft.id} />

      {/* RF-4.1 + RF-4.2: media picker (non su rejected/published) */}
      {draft.status !== "rejected" && draft.status !== "published" && (
        <DraftMediaPicker
          draftId={draft.id}
          brandSlug={slug}
          currentAsset={currentAsset}
          availableAssets={availableAssets}
          availableTemplates={availableTemplates}
          draftContext={{
            topicLabel: draft.topicLabel,
            generatedText: draft.generatedText,
          }}
        />
      )}

      {/* RF-4.6 Anteprima per canale (RF-2.2 font brand applicato) */}
      {brand && (
        <ChannelPreviews
          brandDisplayName={brand.displayName}
          brandLogoUrl={brand.logoUrl}
          brandFontFamily={brand.fontFamily}
          text={draft.generatedText}
          imageUrl={currentAsset?.signedUrl ?? null}
        />
      )}
      {/* Su published: mostra immagine ma read-only */}
      {draft.status === "published" && currentAsset && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-medium text-text">Immagine pubblicata</h3>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentAsset.signedUrl}
            alt={currentAsset.caption || "media"}
            className="max-h-64 rounded-md border border-border object-contain"
          />
        </div>
      )}

      {draft.status === "draft" && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <form action={approveContentDraft.bind(null, draft.id)} className="flex-1">
            <Button type="submit" className="w-full bg-success text-white hover:bg-success/90">
              <Check className="mr-2 h-4 w-4" /> Approva
            </Button>
          </form>

          <details className="flex-1 rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium text-danger">
              <X className="mr-1 inline h-4 w-4" /> Rifiuta con motivo
            </summary>
            <form
              action={async (formData: FormData) => {
                "use server";
                const reason = String(formData.get("reason") ?? "");
                await rejectContentDraft(draft.id, reason);
              }}
              className="mt-3 space-y-2"
            >
              <Label htmlFor="reason">Motivo (obbligatorio, 1-500 char)</Label>
              <Textarea
                id="reason"
                name="reason"
                required
                maxLength={500}
                rows={3}
                placeholder="Es. Tono troppo formale, mancano dettagli sulla promozione"
              />
              <div className="flex justify-end">
                <Button type="submit" className="bg-danger text-white hover:bg-danger/90">
                  Conferma rifiuto
                </Button>
              </div>
            </form>
          </details>
        </div>
      )}

      {draft.status === "approved" && <ScheduleDraftForm draftId={draft.id} />}

      {draft.status === "scheduled" && draft.scheduledAt && (
        <div className="space-y-3">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            <strong>Programmato</strong> per {formatDateTime(draft.scheduledAt)}. Il sistema non
            pubblica automaticamente in F1.5b-α: quando avrai pubblicato manualmente sul canale,
            torna qui e clicca &quot;Segna come pubblicato&quot;.
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form action={unscheduleContentDraft.bind(null, draft.id)} className="flex-1">
              <Button type="submit" variant="outline" className="w-full">
                Annulla programmazione
              </Button>
            </form>
            <form action={markContentDraftPublished.bind(null, draft.id)} className="flex-1">
              <Button type="submit" className="w-full bg-primary text-white hover:bg-primary-hover">
                <Check className="mr-2 h-4 w-4" /> Segna come pubblicato adesso
              </Button>
            </form>
          </div>
        </div>
      )}

      {draft.status === "approved" && draft.approvedAt && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-text-muted">
          Approvato il {formatDateTime(draft.approvedAt)}. Programmalo con il form sopra per farlo
          apparire nel calendario editoriale.
        </div>
      )}

      {draft.status === "published" && draft.publishedAt && (
        <div className="rounded-lg border border-text-muted/30 bg-text-muted/10 p-4 text-sm">
          <strong>Pubblicato</strong> il {formatDateTime(draft.publishedAt)}. Nessuna altra azione
          disponibile su questo contenuto.
        </div>
      )}

      {draft.status === "rejected" && draft.rejectedAt && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm">
          <div>
            <strong>Rifiutato</strong> il {formatDateTime(draft.rejectedAt)}.
          </div>
          <div className="mt-2">
            <strong>Motivo:</strong> {draft.rejectionReason}
          </div>
        </div>
      )}

      {/* RF-3.9 Richiesta materiali (foto/video). Non mostrato su rejected/published. */}
      {draft.status !== "rejected" && draft.status !== "published" && (
        <div className="border-t border-border pt-4">
          <MaterialRequestForm draftId={draft.id} />
        </div>
      )}
    </div>
  );
}
