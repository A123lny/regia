// Implementazione canonica shadcn: clsx fonde le classi, twMerge risolve i conflitti Tailwind.
// Sostituisce il pacchetto obscure "cn" (rimosso per RS-6 / RNF-1 supply chain).
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
