// Hub area Rete. Reindirizza alla prima scheda accessibile.

import { redirect } from "next/navigation";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability, type Capability } from "@/lib/auth/permissions";

type Tab = { href: string; capability: Capability };

const TABS: Tab[] = [
 { href: "/ristoranti", capability: "partner.read" },
 { href: "/fornitori", capability: "supply.read" },
 { href: "/catalogo", capability: "catalog.read" },
 { href: "/ordini", capability: "orders.read" },
];

export default async function ReteHubPage() {
 const session = await getSessionOrRedirect();
 const first = TABS.find((t) => hasCapability(session.role, t.capability));
 redirect(first ? first.href : "/oggi");
}
