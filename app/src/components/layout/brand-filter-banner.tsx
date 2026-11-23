// Banner globale quando e' attivo un filtro marchio (cookie regia_brand).
// L'utente vede sempre quale brand sta filtrando + un bottone per tornare
// a "Tutti i marchi". Posizionato nell'app-shell sotto l'header.

import { X } from "lucide-react";
import { setBrandFilterAction } from "./brand-picker-action";

type BrandOption = { slug: string; displayName: string; color: string };

export function BrandFilterBanner({
  currentBrand,
  brands,
}: {
  currentBrand: string | null;
  brands: BrandOption[];
}) {
  if (!currentBrand) return null;
  const brand = brands.find((b) => b.slug === currentBrand);
  if (!brand) return null;

  return (
    <div className="border-b border-border bg-surface-muted px-4 py-2 text-sm">
      <div className="flex items-center justify-between gap-3 lg:mx-auto lg:max-w-6xl">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: brand.color }}
            aria-hidden="true"
          />
          <span className="text-text">
            Stai filtrando per <strong>{brand.displayName}</strong>
          </span>
        </div>
        <form
          action={async () => {
            "use server";
            await setBrandFilterAction("all");
          }}
        >
          <button
            type="submit"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-muted hover:bg-black/5 hover:text-text"
          >
            <X className="h-3 w-3" />
            Rimuovi filtro
          </button>
        </form>
      </div>
    </div>
  );
}
