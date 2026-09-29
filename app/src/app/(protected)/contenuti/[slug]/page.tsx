import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, Calendar, ListChecks, Zap } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { BrandChip } from "@/components/brand/brand-chip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listContentDraftsByBrand, listDraftsByPlanBatch } from "@/modules/m03-editorial/public";
import type { ContentDraftStatus } from "@/modules/m03-editorial/public";
import { getBrandBySlug } from "@/modules/m02-brand/public";
import { HelpButton } from "@/components/help/help-button";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
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

export default async function BrandContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ planBatchId?: string }>;
}) {
  const session = await getSessionOrRedirect();

  const { slug } = await params;
  const { planBatchId } = await searchParams;

  const brand = await getBrandBySlug(session.organizationId, slug);
  if (!brand) notFound();

  const brandId = brand.id;
  const brandSlug = brand.slug;
  const displayName = brand.displayName;
  const brandColor = brand.color;

  const drafts = planBatchId
    ? await listDraftsByPlanBatch(session.organizationId, planBatchId)
    : await listContentDraftsByBrand(brandId, session.organizationId, 20);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/contenuti"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Contenuti
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandChip slug={brandSlug} name={displayName} color={brandColor} />
            <h1 className="font-serif text-3xl font-semibold text-text">{displayName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/contenuti/${brandSlug}/calendario`}>
              <Button variant="outline">
                <Calendar className="mr-2 h-4 w-4" /> Calendario
              </Button>
            </Link>
            <Link href={`/contenuti/${brandSlug}/piano`}>
              <Button variant="outline">
                <ListChecks className="mr-2 h-4 w-4" /> Piano 14gg
              </Button>
            </Link>
            <Link href={`/contenuti/${brandSlug}/servizio`}>
              <Button variant="outline">
                <Zap className="mr-2 h-4 w-4" /> Corsia veloce
              </Button>
            </Link>
            <Link href={`/contenuti/${brandSlug}/nuovo`}>
              <Button className="bg-primary text-white hover:bg-primary-hover">
                <Sparkles className="mr-2 h-4 w-4" /> Nuovo contenuto
              </Button>
            </Link>
            <HelpButton pageKey="contenuti" />
          </div>
        </div>
        {planBatchId && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            Stai visualizzando le {drafts.length} bozze del piano appena generato.{" "}
            <Link href={`/contenuti/${brandSlug}`} className="underline hover:no-underline">
              Torna a tutte le bozze
            </Link>
          </div>
        )}
      </header>

      <div className="rounded-lg border border-border bg-surface">
        {drafts.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            Nessun contenuto ancora.{" "}
            <Link href={`/contenuti/${brandSlug}/nuovo`} className="text-primary hover:underline">
              Genera il primo
            </Link>
            .
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Canale</TableHead>
                <TableHead>Tema / anteprima</TableHead>
                <TableHead className="w-28">Stato</TableHead>
                <TableHead className="w-24">Costo</TableHead>
                <TableHead className="w-40">Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.map((d) => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-surface-muted">
                  <TableCell>
                    <Badge className="border border-border bg-surface-muted text-text-muted">
                      Social
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/contenuti/${brandSlug}/${d.id}`}
                      className="block hover:text-primary"
                    >
                      <div className="font-medium">{truncate(d.themeInput, 60)}</div>
                      <div className="mt-0.5 text-xs text-text-muted">
                        {truncate(d.generatedText, 100)}
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={d.status} />
                  </TableCell>
                  <TableCell className="text-xs text-text-muted">${d.costUsd.toFixed(4)}</TableCell>
                  <TableCell className="text-xs text-text-muted">
                    {formatDateTime(d.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
