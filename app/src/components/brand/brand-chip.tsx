// Chip colorato per marchio. Colori identità fissi (non da CSS vars — sono valori
// del brand kit, non parte del tema). Riusato ovunque compare un marchio (RF-2.6).

type BrandSlug = "lenny" | "stazione" | "eni-cafe" | "officina";

const BRAND_META: Record<BrandSlug, { name: string; color: string }> = {
  lenny: { name: "Lenny", color: "#FF6B35" },
  stazione: { name: "Stazione", color: "#1E5F8C" },
  "eni-cafe": { name: "Eni Cafè", color: "#8C5E1E" },
  officina: { name: "Officina", color: "#3E4C59" },
};

export function BrandChip({ brand }: { brand: BrandSlug }) {
  const meta = BRAND_META[brand];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-text">
      <span
        data-testid={`brand-dot-${brand}`}
        style={{ backgroundColor: meta.color }}
        className="h-2 w-2 rounded-full"
        aria-hidden="true"
      />
      {meta.name}
    </span>
  );
}
