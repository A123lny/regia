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

export default async function ContenutiIndexPage() {
  const session = await getSessionOrRedirect();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data } = await admin
    .from("brands")
    .select("id, slug, display_name")
    .eq("organization_id", session.organizationId)
    .order("display_name");

  const brands = (data ?? []) as Array<{
    id: string;
    slug: string;
    display_name: string;
  }>;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-text">Contenuti</h1>
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
                    <BrandChip brand={b.slug as BrandSlug} />
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/contenuti/${b.slug}`} className="font-medium hover:text-primary">
                    {b.display_name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/contenuti/${b.slug}`}
                    aria-label={`Vai ai contenuti di ${b.display_name}`}
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
