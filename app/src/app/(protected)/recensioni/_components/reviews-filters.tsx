"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Brand } from "@/modules/m02-brand/public";

export function ReviewsFilters({ brands }: { brands: Brand[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const classification = sp.get("classification") ?? "all";
  const status = sp.get("status") ?? "all";
  const brand = sp.get("brand") ?? "all";

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    router.push(`/recensioni?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <select
        value={brand}
        onChange={(e) => updateParam("brand", e.target.value)}
        className="rounded border border-slate-300 px-2 py-1"
      >
        <option value="all">Tutti i marchi</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.displayName}
          </option>
        ))}
      </select>
      <select
        value={classification}
        onChange={(e) => updateParam("classification", e.target.value)}
        className="rounded border border-slate-300 px-2 py-1"
      >
        <option value="all">Tutte le classificazioni</option>
        <option value="positive">Positive</option>
        <option value="negative">Negative</option>
        <option value="serious">Grave</option>
      </select>
      <select
        value={status}
        onChange={(e) => updateParam("status", e.target.value)}
        className="rounded border border-slate-300 px-2 py-1"
      >
        <option value="all">Tutti gli stati</option>
        <option value="pending">In attesa bozza</option>
        <option value="draft_ready">Bozza pronta</option>
        <option value="approved">Approvata</option>
        <option value="published_externally">Pubblicata</option>
        <option value="serious_signaled">Grave segnalata</option>
        <option value="serious_resolved">Grave risolta</option>
      </select>
    </div>
  );
}
