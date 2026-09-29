// Marchio: logo se caricato, altrimenti placeholder grigio con icona.
// Usato ovunque compare l'identita visiva di un marchio (chip, brand cards,
// legenda calendario, drawer, ecc.). Sostituisce il vecchio pallino colorato.

import { ImageIcon } from "lucide-react";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<Size, { box: string; icon: string; text: string }> = {
  xs: { box: "h-4 w-4", icon: "h-2.5 w-2.5", text: "text-[8px]" },
  sm: { box: "h-6 w-6", icon: "h-3 w-3", text: "text-[10px]" },
  md: { box: "h-8 w-8", icon: "h-4 w-4", text: "text-xs" },
  lg: { box: "h-12 w-12", icon: "h-5 w-5", text: "text-sm" },
  xl: { box: "h-16 w-16", icon: "h-7 w-7", text: "text-base" },
};

type Props = {
  logoUrl: string | null;
  name: string;
  size?: Size;
  className?: string;
  rounded?: "full" | "md" | "lg";
};

export function BrandLogo({ logoUrl, name, size = "md", className = "", rounded = "md" }: Props) {
  const s = SIZE_MAP[size];
  const roundedClass =
    rounded === "full" ? "rounded-full" : rounded === "lg" ? "rounded-lg" : "rounded-md";

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`Logo ${name}`}
        className={`${s.box} ${roundedClass} object-cover border border-border ${className}`}
      />
    );
  }

  // Placeholder generico grigio (nessun logo caricato)
  return (
    <div
      className={`${s.box} ${roundedClass} flex items-center justify-center border border-border bg-surface-muted text-text-muted ${className}`}
      title={`${name} — nessun logo caricato`}
    >
      <ImageIcon className={s.icon} aria-hidden="true" />
    </div>
  );
}
