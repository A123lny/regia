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

type Brand = { slug: string; displayName: string };

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
      <SelectTrigger className="w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tutti i marchi</SelectItem>
        {brands.map((b) => (
          <SelectItem key={b.slug} value={b.slug}>
            <div className="flex items-center gap-2">
              <BrandChip brand={b.slug as BrandSlug} />
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
