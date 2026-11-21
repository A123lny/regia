"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function BrandKitError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      title="Errore nel caricamento del marchio"
      description="Non siamo riusciti a caricare il marchio. Prova a ricaricare."
      error={error}
      reset={reset}
    />
  );
}
