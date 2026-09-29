"use client";

// RF-12.7 Icona ? con popover di help contestuale.

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { getHelpEntry } from "./help-content";

export function HelpButton({ pageKey }: { pageKey: string }) {
  const [open, setOpen] = useState(false);
  const entry = getHelpEntry(pageKey);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-primary"
        aria-label={`Aiuto: ${entry.title}`}
        title="Aiuto contestuale"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="mt-14 w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                <h2
                  className="text-lg font-bold text-text"
                  style={{ fontFamily: "var(--font-bricolage)" }}
                >
                  {entry.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted"
                aria-label="Chiudi aiuto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                {entry.body}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
