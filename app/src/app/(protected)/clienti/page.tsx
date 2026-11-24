// Hub area Clienti. Reindirizza alla prima scheda accessibile.
// La TabBar e' nel layout globale, la pagina visibile e' la vecchia route
// (es. /contatti). Qui facciamo solo lo smistamento.

import { redirect } from "next/navigation";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability, type Capability } from "@/lib/auth/permissions";

type Tab = { href: string; capability: Capability };

const TABS: Tab[] = [
 { href: "/contatti", capability: "contacts.read" },
 { href: "/promemoria", capability: "reminders.read" },
 { href: "/anti-abbandono", capability: "abandonment.read" },
 { href: "/fedelta", capability: "loyalty.read" },
 { href: "/iscrizioni", capability: "signup.events.read" },
 { href: "/segmenti", capability: "segment.read" },
 { href: "/recensioni", capability: "reviews.read" },
 { href: "/analytics", capability: "analytics.read" },
];

export default async function ClientiHubPage() {
 const session = await getSessionOrRedirect();
 const first = TABS.find((t) => hasCapability(session.role, t.capability));
 redirect(first ? first.href : "/oggi");
}
