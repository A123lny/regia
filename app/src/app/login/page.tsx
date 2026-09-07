import { login } from "./actions";

export default function LoginPage() {
  return (
    <main style={{ padding: "3rem", maxWidth: "24rem", margin: "0 auto" }}>
      <h1>Accedi a Regìa</h1>
      <form action={login} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Email
          <input name="email" type="email" required style={{ width: "100%" }} />
        </label>
        <label>
          Password
          <input name="password" type="password" required style={{ width: "100%" }} />
        </label>
        <button type="submit">Accedi</button>
      </form>
      <p style={{ marginTop: "1rem", fontSize: "0.9em", color: "#666" }}>
        F0: nessun utente creato al primo avvio. Vedi <code>docs/runbook-backup.md</code> per la
        procedura di creazione manuale del primo Owner nel DB locale.
      </p>
    </main>
  );
}
