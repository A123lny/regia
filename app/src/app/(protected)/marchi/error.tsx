"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function MarchiError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback title="Errore nel caricamento marchi" error={error} reset={reset} />;
}
