// Chip colorato per marchio, con LOGO al posto del pallino colorato (RF-2.2).
// Due modalita d'uso:
//   1. <BrandChip brand="lenny" />  (retrocompat: lookup statico dei 4 seed, senza logo)
//   2. <BrandChip name="X" color="#RRGGBB" logoUrl={...} />  (dinamico dal DB, con logo)
// Il logo viene mostrato se presente, altrimenti placeholder grigio (BrandLogo).

import { BrandLogo } from "./brand-logo";

export type BrandSlug = "lenny" | "stazione" | "eni-cafe" | "officina";

const BRAND_META: Record<BrandSlug, { name: string; color: string }> = {
  lenny: { name: "Lenny", color: "#FF6B35" },
  stazione: { name: "Stazione", color: "#1E5F8C" },
  "eni-cafe": { name: "Eni Cafè", color: "#8C5E1E" },
  officina: { name: "Officina", color: "#556B2F" },
};

type StaticProps = { brand: BrandSlug };
type DynamicProps = { name: string; color: string; slug?: string; logoUrl?: string | null };
type BrandChipProps = StaticProps | DynamicProps;

function isStatic(p: BrandChipProps): p is StaticProps {
  return "brand" in p;
}

export function BrandChip(props: BrandChipProps) {
  const meta = isStatic(props) ? BRAND_META[props.brand] : { name: props.name, color: props.color };
  const logoUrl = isStatic(props) ? null : (props.logoUrl ?? null);
  const dataSlug = isStatic(props) ? props.brand : (props.slug ?? "");
  return (
    <span
      data-testid={dataSlug ? `brand-chip-${dataSlug}` : undefined}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2 py-1 text-xs font-medium text-text"
    >
      <BrandLogo logoUrl={logoUrl} name={meta.name} size="xs" rounded="full" />
      {meta.name}
    </span>
  );
}
