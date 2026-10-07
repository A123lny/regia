import Link from "next/link";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import {
  listDeliveryZones,
  BLACKOUT_KIND_LABELS,
  type DeliveryBlackoutKind,
} from "@/modules/m13-governance/public";
import { listBrands } from "@/modules/m02-brand/public";
import { HelpButton } from "@/components/help/help-button";
import { DeliveryZonesClient } from "./delivery-zones-client";

const BLACKOUT_KINDS: DeliveryBlackoutKind[] = ["snow", "rain", "event", "road_closure", "other"];

export default async function DeliveryZonesPage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "delivery_zones.read")) {
    return <div className="p-8 text-sm text-text-muted">Non hai accesso a questa sezione.</div>;
  }
  const canManage = hasCapability(session.role, "delivery_zones.manage");
  const canToggleBlackout = hasCapability(session.role, "delivery_zones.blackout.toggle");

  const [zones, brands] = await Promise.all([
    listDeliveryZones(session.organizationId),
    listBrands(session.organizationId),
  ]);

  // Filtriamo i brand "food-like" per il form di nuova zona:
  // in F1 e' Lenny ma lasciamo scegliere al titolare (brand editor piu avanti).
  const deliveryBrands = brands
    .filter((b) => !b.isArchived)
    .map((b) => ({
      id: b.id,
      slug: b.slug,
      displayName: b.displayName,
      color: b.color ?? "#7a6857",
    }));

  const activeBlackouts = zones.filter((z) => z.activeBlackout !== null);

  return (
    <main className="space-y-6 p-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <nav className="text-xs text-text-muted">
            <Link href="/governance" className="underline">
              Governance
            </Link>{" "}
            / Zone di consegna
          </nav>
          <HelpButton pageKey="zone-consegna" />
        </div>
        <h1 className="mt-1 font-serif text-2xl font-bold">Zone di consegna variabili</h1>
        <p className="mt-1 text-sm text-text-muted">
          RN-52 · Vincolo assoluto:{" "}
          <strong>
            mai inviare promozioni food a chi abita in zona temporaneamente non servita
          </strong>
          . Qui attivi/chiudi i blackout (neve, pioggia, evento, chiusura stradale). Il motore promo
          chiama <code>assertDeliveryZonesOk</code>
          prima di accodare.
        </p>
      </header>

      {activeBlackouts.length > 0 && (
        <section className="rounded-lg border-2 border-danger/50 bg-red-50 p-4">
          <h2 className="font-serif text-lg font-bold text-danger">
            🚨 Blackout attivi ({activeBlackouts.length})
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {activeBlackouts.map((z) => (
              <li key={z.id} className="rounded border border-danger/30 bg-white p-2">
                <strong>
                  {z.brandDisplayName} · {z.name}
                </strong>{" "}
                — {BLACKOUT_KIND_LABELS[z.activeBlackout!.kind]}
                {z.activeBlackout!.reason && <> · {z.activeBlackout!.reason}</>}
                <br />
                <span className="text-xs text-text-muted">
                  Dal {new Date(z.activeBlackout!.startAt).toLocaleString("it-IT")}
                  {z.activeBlackout!.endAt && (
                    <>
                      {" · fine prevista: "}
                      {new Date(z.activeBlackout!.endAt).toLocaleString("it-IT")}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DeliveryZonesClient
        zones={zones}
        brands={deliveryBrands}
        blackoutKinds={BLACKOUT_KINDS}
        blackoutLabels={BLACKOUT_KIND_LABELS}
        canManage={canManage}
        canToggleBlackout={canToggleBlackout}
      />
    </main>
  );
}
