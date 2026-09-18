import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, Calendar } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
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
import { listContentDraftsByBrand } from "@/modules/m03-editorial/public";
import type { ContentDraftStatus } from "@/modules/m03-editorial/public";

type BrandSlug = "lenny" | "stazione" | "eni-cafe" | "officina";

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

export default async function BrandContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await getSessionOrRedirect();
  if (session.role !== "owner") notFound();

  const { slug } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: brandRow } = await admin
    .from("brands")
    .select("id, slug, display_name")
    .eq("slug", slug)
    .eq("organization_id", session.organizationId)
    .maybeSingle();
  if (!brandRow) notFound();

  const brandId = brandRow.id as string;
  const brandSlug = brandRow.slug as string;
  const displayName = brandRow.display_name as string;

  const drafts = await listContentDraftsByBrand(brandId, session.organizationId, 20);

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
            <BrandChip brand={brandSlug as BrandSlug} />
            <h1 className="font-serif text-3xl font-semibold text-text">{displayName}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/contenuti/${brandSlug}/calendario`}>
              <Button variant="outline">
                <Calendar className="mr-2 h-4 w-4" /> Calendario
              </Button>
            </Link>
            <Link href={`/contenuti/${brandSlug}/nuovo`}>
              <Button className="bg-primary text-white hover:bg-primary-hover">
                <Sparkles className="mr-2 h-4 w-4" /> Nuovo contenuto
              </Button>
            </Link>
          </div>
        </div>
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
