"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorFallback
      title="Errore nel caricamento della dashboard"
      description="Non siamo riusciti a caricare la dashboard. Prova a ricaricare."
      error={error}
      reset={reset}
    />
  );
}
