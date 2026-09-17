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
} from "@/modules/m03-editorial/public";
import type { ContentDraftStatus } from "@/modules/m03-editorial/public";

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
  return <Badge className="border border-border bg-surface-muted text-text-muted">Bozza</Badge>;
}

export default async function DraftDetailPage({
  params,
}: {
  params: Promise<{ slug: string; draftId: string }>;
}) {
  const session = await getSessionOrRedirect();
  if (session.role !== "owner") notFound();

  const { slug, draftId } = await params;
  const draft = await getContentDraft(draftId);
  if (!draft) notFound();

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
        </CardContent>
      </Card>

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

      {draft.status === "approved" && draft.approvedAt && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
          <strong>Approvato</strong> il {formatDateTime(draft.approvedAt)}. Sarà pubblicabile quando
          M5 publishing sarà disponibile (F2).
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
    </div>
  );
}
