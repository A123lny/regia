"use client";

// Error boundary globale (ultimo baluardo): cattura errori che sfuggono a tutti
// gli error.tsx dei segmenti (es. errori nel root layout o errori di hydration
// come React #418/#441). Mostra un messaggio sobrio SENZA leak di dettagli
// tecnici all'utente finale.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global error]", error);
  }, [error]);

  return (
    <html lang="it">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <div
          style={{
            maxWidth: 560,
            margin: "48px auto",
            padding: 24,
            border: "1px solid #ddd",
            borderRadius: 8,
          }}
        >
          <h1 style={{ marginTop: 0 }}>Qualcosa non ha funzionato</h1>
          <p>
            Si è verificato un errore imprevisto. Prova a ricaricare la pagina. Se il problema
            persiste, riprova più tardi.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#666", fontFamily: "monospace" }}>
              Codice: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 12,
              padding: "8px 16px",
              background: "#111",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Ricarica
          </button>
        </div>
      </body>
    </html>
  );
}
