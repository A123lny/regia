"use client";

// Error fallback riutilizzabile per i file app/*/error.tsx.
// NON mostra il messaggio grezzo (potrebbe contenere errori tecnici tipo
// "Minified React error #441" o dettagli infrastruttura/DB che confondono
// l'utente). Il digest e' safe da esporre (identificativo breve per log).

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  description?: string;
  error: Error & { digest?: string };
  reset: () => void;
};

export function ErrorFallback({ title, description, error, reset }: Props) {
  useEffect(() => {
    // Log lato client per il debug: appare in console + Sentry/Vercel log.
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 p-6">
      <h2 className="font-serif text-xl font-semibold text-danger">{title}</h2>
      <p className="mt-2 text-sm text-text-muted">
        {description ?? "Qualcosa non ha funzionato. Riprova tra un istante."}
      </p>
      {error.digest && (
        <p className="mt-1 text-[11px] font-mono text-text-muted/70">
          Codice errore: {error.digest}
        </p>
      )}
      <Button onClick={reset} className="mt-4 bg-primary text-white hover:bg-primary-hover">
        Ricarica
      </Button>
    </div>
  );
}
