// Next.js instrumentation hook — gira una volta all'avvio del server.
// Setta il fuso orario del processo Node a Europe/Rome prima che qualsiasi
// Date.toLocaleString(...) venga chiamato lato server.
//
// Fix bug: su Vercel il runtime default e' UTC, cosi' le pagine SSR
// (es. bozze, liste voucher, scadenze) mostravano l'ora UTC invece
// che l'ora italiana.
//
// Nota: le pagine Client Component continuano a usare il fuso del browser
// (gia' italiano per l'utente), questo fix riguarda solo il server.

export async function register() {
  // nodejs runtime: Next.js imposta NEXT_RUNTIME='nodejs'.
  // Nel runtime edge non abbiamo tzset ma al momento non renderizziamo
  // pagine con date in edge, quindi questo basta.
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    process.env["TZ"] = "Europe/Rome";
  }
}
