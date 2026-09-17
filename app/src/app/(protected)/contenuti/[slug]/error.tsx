"use client";

import { Button } from "@/components/ui/button";

export default function ContentBrandError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 p-6">
      <h2 className="font-serif text-xl font-semibold text-danger">
        Errore nel caricamento dei contenuti
      </h2>
      <p className="mt-2 text-sm text-text-muted">{error.message}</p>
      <Button onClick={reset} className="mt-4 bg-primary text-white hover:bg-primary-hover">
        Ricarica
      </Button>
    </div>
  );
}
