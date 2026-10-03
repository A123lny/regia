import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import { listRiderCapacityWindows, listRiderShiftRequests } from "@/modules/m13-governance/public";
import { listBrands } from "@/modules/m02-brand/public";
import { RiderCapacityClient } from "./rider-capacity-client";

export default async function RiderCapacityPage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "rider_capacity.read")) {
    return <div className="p-8 text-sm text-text-muted">Non hai accesso a questa sezione.</div>;
  }
  const canManage = hasCapability(session.role, "rider_capacity.manage");
  const canRequest = hasCapability(session.role, "rider_shift.request");
  const canFulfill = hasCapability(session.role, "rider_shift.fulfill");

  const [windows, shiftRequests, brands] = await Promise.all([
    listRiderCapacityWindows(session.organizationId),
    listRiderShiftRequests(session.organizationId, { onlyActive: true }),
    listBrands(session.organizationId),
  ]);

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold">Capacita rider</h1>
        <p className="mt-1 text-sm text-text-muted">
          RF-6.18 · RN-41/42/43 · Configurazione finestre settimanali e richieste quantificate.
          Nessuna promo food deve generare domanda oltre la capacita della fascia.
        </p>
      </header>
      <RiderCapacityClient
        brands={brands.map((b) => ({
          id: b.id,
          slug: b.slug,
          displayName: b.displayName,
          color: b.color ?? "#7a6857",
        }))}
        windows={windows}
        shiftRequests={shiftRequests}
        canManage={canManage}
        canRequest={canRequest}
        canFulfill={canFulfill}
      />
    </main>
  );
}
