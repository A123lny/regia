// Nuova home "Oggi" — placeholder che per ora carica la stessa logica della
// vecchia dashboard. La Home finale verra' rifatta nella Fase 2 del refactor
// UI (Da fare / campo "Crea un post" / colonna "Questa settimana").

import type { Metadata } from "next";
import DashboardPage from "../dashboard/page";

export const metadata: Metadata = { title: "Oggi" };

export default async function OggiPage() {
  // Pass-through verso la vecchia dashboard. Non e' un redirect server-side
  // perche' il contenuto va renderizzato sotto /oggi (il redirect e'
  // configurato nella direzione opposta: /dashboard -> /oggi).
  return <DashboardPage />;
}
