"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function ImpostazioniError({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 return (
 <ErrorFallback
 title="Errore nel caricamento delle impostazioni"
 error={error}
 reset={reset}
 />
 );
}
