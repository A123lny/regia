"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function CalendarioError({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 return (
 <ErrorFallback title="Errore nel caricamento del calendario" error={error} reset={reset} />
 );
}
