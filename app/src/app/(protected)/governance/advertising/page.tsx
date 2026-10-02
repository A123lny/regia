import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import {
  listAdvertisingBudgets,
  listOverrunRequests,
  AD_CATEGORY_LABELS,
  type AdCategory,
} from "@/modules/m13-governance/public";
import { listBrands } from "@/modules/m02-brand/public";
import { AdvertisingClient } from "./advertising-client";

const AD_CATEGORIES: AdCategory[] = ["social_sponsored", "google_ads_search", "google_ads_display"];

export default async function AdvertisingPage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "advertising.read")) {
    return <div className="p-8 text-sm text-text-muted">Non hai accesso a questa sezione.</div>;
  }
  const canManage = hasCapability(session.role, "advertising.budgets.manage");
  const canToggle = hasCapability(session.role, "advertising.toggle");
  const canDecideOverrun = hasCapability(session.role, "advertising.overrun.decide");

  const [budgets, overrunPending, brands] = await Promise.all([
    listAdvertisingBudgets(session.organizationId),
    listOverrunRequests(session.organizationId, "pending"),
    listBrands(session.organizationId),
  ]);

  return (
    <main className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold">Advertising e tetti di spesa</h1>
        <p className="mt-1 text-sm text-text-muted">
          RF-13.1..13.6 · Configurazione budget e interruttori per marchio e categoria. Nessuna
          categoria parte accesa: ogni attivazione e&apos; una decisione esplicita del titolare.
        </p>
      </header>
      <AdvertisingClient
        brands={brands.map((b) => ({
          id: b.id,
          slug: b.slug,
          displayName: b.displayName,
          color: b.color ?? "#7a6857",
        }))}
        budgets={budgets}
        overrunPending={overrunPending}
        categories={AD_CATEGORIES}
        categoryLabels={AD_CATEGORY_LABELS}
        canManage={canManage}
        canToggle={canToggle}
        canDecideOverrun={canDecideOverrun}
      />
    </main>
  );
}
