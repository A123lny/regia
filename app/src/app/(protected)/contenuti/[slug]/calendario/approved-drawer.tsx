"use client";

import Link from "next/link";
import type { ContentDraft } from "@/modules/m03-editorial/public";
import { DraggableCard } from "./draggable-card";

export function ApprovedDrawer({
  approved,
  brandSlug,
}: {
  approved: ContentDraft[];
  brandSlug: string;
}) {
  return (
    <aside className="rounded-lg border border-border bg-surface p-3">
      <h2 className="mb-2 text-sm font-semibold text-text">
        Approvati in attesa <span className="text-text-muted">({approved.length})</span>
      </h2>
      {approved.length === 0 ? (
        <p className="text-xs text-text-muted">
          Nessun contenuto approvato in attesa di programmazione.{" "}
          <Link
            href={`/contenuti/${brandSlug}/nuovo`}
            className="text-primary underline-offset-2 hover:underline"
          >
            Crea uno nuovo
          </Link>
        </p>
      ) : (
        <div className="space-y-2">
          {approved.map((d) => (
            <DraggableCard key={d.id} draft={d} />
          ))}
        </div>
      )}
    </aside>
  );
}
