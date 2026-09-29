// RF-12.4 Archivio ricorrenze annuali (CRUD).

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listAllRecurrences } from "@/modules/m03-editorial/public";
import { listBrands } from "@/modules/m02-brand/public";
import { RecurrencesAdminClient } from "./recurrences-admin-client";
import { HelpButton } from "@/components/help/help-button";

export default async function RicorrenzePage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "content.generate")) notFound();

  const [recurrences, brands] = await Promise.all([
    listAllRecurrences(session.organizationId),
    listBrands(session.organizationId, "active"),
  ]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/impostazioni"
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Impostazioni
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Ricorrenze annuali
            </h1>
          </div>
          <HelpButton pageKey="ricorrenze" />
        </div>
        <p className="text-sm text-text-muted">
          RF-12.4: eventi che tornano ogni anno (Natale, cambio gomme, chiusure ferie). Il sistema
          li propone in dashboard quando arriva il periodo (today + preavviso).
        </p>
      </header>

      <RecurrencesAdminClient recurrences={recurrences} brands={brands} />
    </div>
  );
}
