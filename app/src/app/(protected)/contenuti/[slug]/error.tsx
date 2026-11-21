"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function ContentBrandError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      title="Errore nel caricamento dei contenuti"
      description="Non siamo riusciti a caricare i contenuti. Prova a ricaricare."
      error={error}
      reset={reset}
    />
  );
}
