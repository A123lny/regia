import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { getAdminClient } from "@/lib/db/admin";
import { BrandChip } from "@/components/brand/brand-chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BrandSlug = "lenny" | "stazione" | "eni-cafe" | "officina";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function MarchiPage() {
  const session = await getSessionOrRedirect();
  const admin = getAdminClient();
  // F0: no RLS select policy yet — bypass via service_role. Rimosso in F1.3.
  const { data } = await admin
    .from("brands")
    .select("id, slug, display_name, created_at")
    .eq("organization_id", session.organizationId)
    .order("display_name");

  const brands = (data ?? []) as Array<{
    id: string;
    slug: string;
    display_name: string;
    created_at: string;
  }>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-text">Marchi</h1>
        <p className="mt-1 text-sm text-text-muted">
          I quattro marchi del gruppo (RF-2.1). Clicca un marchio per editarne il brand kit
          (tono, contesto strategico, rubriche, vincoli redazionali).
        </p>
      </header>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marchio</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Creato</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((b) => (
              <TableRow key={b.id} className="cursor-pointer hover:bg-surface-muted">
                <TableCell>
                  <Link href={`/marchi/${b.slug}`}>
                    <BrandChip brand={b.slug as BrandSlug} />
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/marchi/${b.slug}`} className="font-medium hover:text-primary">
                    {b.display_name}
                  </Link>
                </TableCell>
                <TableCell>
                  <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">
                    {b.slug}
                  </code>
                </TableCell>
                <TableCell className="text-text-muted">{formatDate(b.created_at)}</TableCell>
                <TableCell>
                  <Link href={`/marchi/${b.slug}`} aria-label={`Modifica ${b.display_name}`}>
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
