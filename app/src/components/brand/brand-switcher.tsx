"use client";

// Select shadcn per lo scope marchio corrente. Client component perché la Select
// di shadcn necessita di stato interattivo. La server action setBrandScope viene
// chiamata dal handler di onValueChange.

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrandChip, type BrandSlug } from "@/components/brand/brand-chip";
import { setBrandScope } from "@/lib/brand/scope";
import { useTransition } from "react";
import { Layers } from "lucide-react";

type Brand = { slug: BrandSlug; displayName: string };

const BRICOLAGE_STYLE = { fontFamily: "var(--font-bricolage)" };

export function BrandSwitcher({ currentScope, brands }: { currentScope: string; brands: Brand[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Select
      value={currentScope}
      disabled={isPending}
      onValueChange={(next) => {
        startTransition(async () => {
          await setBrandScope(next);
        });
      }}
    >
      <SelectTrigger
        className="w-[210px] border-border bg-surface-muted text-xs font-bold uppercase tracking-widest text-text hover:bg-surface"
        style={BRICOLAGE_STYLE}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          value="all"
          className="text-xs font-bold uppercase tracking-widest"
          style={BRICOLAGE_STYLE}
        >
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>Tutti i marchi</span>
          </div>
        </SelectItem>
        {brands.map((b) => (
          <SelectItem key={b.slug} value={b.slug}>
            <div className="flex items-center gap-2">
              <BrandChip brand={b.slug} />
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
