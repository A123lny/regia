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
  // F0: no RLS select policy yet — bypass via service_role.
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
          I quattro marchi del gruppo, configurati come dati (RF-2.1). L&apos;editing arriva in F1.2
          (Brand kit).
        </p>
      </header>

      <div className="flex items-center gap-2">
        <span className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs text-text-muted">
          Configurato · read-only in F1.1
        </span>
      </div>

      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Marchio</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Data creazione</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brands.map((b) => (
              <TableRow key={b.id}>
                <TableCell>
                  <BrandChip brand={b.slug as BrandSlug} />
                </TableCell>
                <TableCell className="font-medium">{b.display_name}</TableCell>
                <TableCell>
                  <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">{b.slug}</code>
                </TableCell>
                <TableCell className="text-text-muted">{formatDate(b.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
