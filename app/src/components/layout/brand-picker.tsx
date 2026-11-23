"use client";

// Selettore marchio globale. In cima alla sidebar.
// - "Tutti i marchi" = cookie 'all' / nessun filtro
// - uno specifico slug = cookie=slug
// Al cambio imposta cookie via server action e ricarica.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBrandFilterAction } from "./brand-picker-action";

type BrandOption = { slug: string; displayName: string; color: string };

export function BrandPicker({
  brands,
  current,
}: {
  brands: BrandOption[];
  current: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    startTransition(async () => {
      await setBrandFilterAction(v);
      router.refresh();
    });
  }

  return (
    <div className="border-b border-border px-3 py-3">
      <label
        htmlFor="brand-picker"
        className="mb-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted"
        style={{ fontFamily: "var(--font-bricolage)" }}
      >
        Marchio
      </label>
      <select
        id="brand-picker"
        value={current ?? "all"}
        onChange={handleChange}
        disabled={pending}
        className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus:border-primary focus:outline-none disabled:opacity-60"
      >
        <option value="all">Tutti i marchi</option>
        {brands.map((b) => (
          <option key={b.slug} value={b.slug}>
            {b.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
