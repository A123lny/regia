import Link from "next/link";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { listBrands } from "@/modules/m02-brand/public";
import { BrandChip } from "@/components/brand/brand-chip";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listContentDraftsByStatus } from "@/modules/m03-editorial/public";
import type { ContentDraftStatus } from "@/modules/m03-editorial/public";
import { HelpButton } from "@/components/help/help-button";

const STATUS_META: Record<
  ContentDraftStatus,
  { label: string; heading: string; subtitle: string }
> = {
  draft: {
    label: "Bozze",
    heading: "Bozze da approvare",
    subtitle: "Contenuti generati in attesa di revisione da parte dell'Owner.",
  },
  approved: {
    label: "Approvate",
    heading: "Approvate da programmare",
    subtitle: "Contenuti approvati che devi ancora inserire in calendario.",
  },
  scheduled: {
    label: "Programmate",
    heading: "In calendario",
    subtitle: "Contenuti con data di pubblicazione fissata.",
  },
  published: {
    label: "Pubblicate",
    heading: "Pubblicate",
    subtitle: "Contenuti già pubblicati. Le metriche di andamento arriveranno con M8 (F2).",
  },
  rejected: {
    label: "Rifiutate",
    heading: "Rifiutate",
    subtitle: "Contenuti rifiutati dall'Owner.",
  },
};

const VALID_STATUS: ReadonlyArray<ContentDraftStatus> = [
  "draft",
  "approved",
  "scheduled",
  "published",
  "rejected",
];

function isValidStatus(s: string | undefined): s is ContentDraftStatus {
  return typeof s === "string" && (VALID_STATUS as readonly string[]).includes(s);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
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

export default async function ContenutiIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSessionOrRedirect();
  const { status } = await searchParams;

  // Modo A: filtro per stato → elenco cross-brand.
  if (isValidStatus(status)) {
    const drafts = await listContentDraftsByStatus(session.organizationId, status, 100);
    const meta = STATUS_META[status];

    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1
                className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
                style={{ fontFamily: "var(--font-bricolage)" }}
              >
                {meta.heading}
              </h1>
              <p className="mt-1 text-sm text-text-muted">{meta.subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="border border-border bg-surface-muted text-text">
                {drafts.length} risultat{drafts.length === 1 ? "o" : "i"}
              </Badge>
              <HelpButton pageKey="contenuti" />
            </div>
          </div>
        </header>

        <div className="rounded-lg border border-border bg-surface">
          {drafts.length === 0 ? (
            <div className="p-10 text-center text-text-muted">
              Nessun contenuto in questo stato.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Marchio</TableHead>
                  <TableHead>Tema / anteprima</TableHead>
                  <TableHead className="w-40">
                    {status === "scheduled"
                      ? "Programmato"
                      : status === "published"
                        ? "Pubblicato"
                        : status === "approved"
                          ? "Approvato"
                          : status === "rejected"
                            ? "Rifiutato"
                            : "Creato"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drafts.map((d) => {
                  const dateIso =
                    status === "scheduled"
                      ? d.scheduledAt
                      : status === "published"
                        ? d.publishedAt
                        : status === "approved"
                          ? d.approvedAt
                          : status === "rejected"
                            ? d.rejectedAt
                            : d.createdAt;
                  return (
                    <TableRow key={d.id} className="cursor-pointer hover:bg-surface-muted">
                      <TableCell>
                        <BrandChip
                          slug={d.brandSlug}
                          name={d.brandDisplayName}
                          color={d.brandColor}
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/contenuti/${d.brandSlug}/${d.id}`}
                          className="block hover:text-primary"
                        >
                          <div className="font-medium">{truncate(d.themeInput, 60)}</div>
                          <div className="mt-0.5 text-xs text-text-muted">
                            {truncate(d.generatedText, 100)}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-text-muted">
                        {formatDateTime(dateIso)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    );
  }

  // Modo B: nessun filtro → tabella marchi attivi.
  const brands = await listBrands(session.organizationId, "active");

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <h1
            className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            Contenuti
          </h1>
          <HelpButton pageKey="contenuti" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Scegli un marchio per generare, approvare e rifiutare bozze di post social usando il brand
          kit come contesto (RF-3.3).
        </p>
      </header>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marchio</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((b) => (
              <TableRow key={b.id} className="cursor-pointer hover:bg-surface-muted">
                <TableCell>
                  <Link href={`/contenuti/${b.slug}`}>
                    <BrandChip slug={b.slug} name={b.displayName} color={b.color} />
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/contenuti/${b.slug}`} className="font-medium hover:text-primary">
                    {b.displayName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/contenuti/${b.slug}`}
                    aria-label={`Vai ai contenuti di ${b.displayName}`}
                  >
                    <ChevronRight className="h-4 w-4 text-text-muted" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
