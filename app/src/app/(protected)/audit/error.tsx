"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function AuditError({
 error,
 reset,
}: {
 error: Error & { digest?: string };
 reset: () => void;
}) {
 return (
 <ErrorFallback
 title="Errore nel caricamento audit log"
 error={error}
 reset={reset}
 />
 );
}
