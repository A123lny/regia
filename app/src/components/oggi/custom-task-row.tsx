"use client";

// Riga task personale con azione "Fatto" inline + link "Apri".
// Riusa completeTaskAction dal modulo m12-daily-use.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { completeTaskAction } from "@/modules/m12-daily-use/public";

export function CustomTaskRow({
  id,
  title,
  description,
  href = "/dashboard#tasks",
}: {
  id: string;
  title: string;
  description?: string | null;
  href?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function markDone() {
    startTransition(async () => {
      try {
        await completeTaskAction(id);
        router.refresh();
      } catch (e) {
        console.error("completeTask failed", e);
      }
    });
  }

  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2.5 hover:border-primary/40">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text">{title}</div>
        {description && (
          <div className="mt-0.5 line-clamp-1 text-xs text-text-muted">{description}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={markDone}
          disabled={pending}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-success/40 bg-success/5 px-2.5 py-1.5 text-xs font-medium text-success hover:bg-success/15 disabled:opacity-50"
          aria-label="Segna come fatto"
        >
          {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Fatto
        </button>
        <Link
          href={href}
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text hover:border-primary hover:text-primary"
        >
          Apri
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </li>
  );
}
