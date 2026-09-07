import { getSessionOrRedirect } from "@/lib/auth/session";

export default async function DashboardPage() {
  const session = await getSessionOrRedirect();
  return (
    <main style={{ padding: "3rem", maxWidth: "48rem", margin: "0 auto" }}>
      <h1>Dashboard</h1>
      <p>
        Ciao. Sei autenticato come <strong>{session.role}</strong> dentro l&apos;organization{" "}
        <code>{session.organizationId}</code>.
      </p>
      <p>La dashboard vera arriverà in F1. Questa pagina serve solo a provare l&apos;auth.</p>
    </main>
  );
}
