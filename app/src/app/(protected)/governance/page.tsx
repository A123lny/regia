// M13 Governance — §8.2 regole autonomia + RF-6.15..6.20 prodotti sconto vietato.

import { notFound } from "next/navigation";
import { ShieldCheck, ShieldAlert, Ban, UserCheck, Zap } from "lucide-react";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { hasCapability } from "@/lib/auth/permissions";
import {
  listAutonomyRules,
  listAllProductsWithDiscountFlag,
} from "@/modules/m13-governance/public";
import { HelpButton } from "@/components/help/help-button";
import { GovernanceClient } from "./governance-client";

export default async function GovernancePage() {
  const session = await getSessionOrRedirect();
  if (!hasCapability(session.role, "governance.read")) notFound();

  const [rules, products] = await Promise.all([
    listAutonomyRules(session.organizationId),
    listAllProductsWithDiscountFlag(session.organizationId),
  ]);

  const canCrud = hasCapability(session.role, "governance.crud");
  const neverCount = rules.filter((r) => r.level === "never").length;
  const humanReviewCount = rules.filter((r) => r.level === "human_review").length;
  const autoCount = rules.filter((r) => r.level === "auto").length;
  const forbiddenProductCount = products.filter((p) => p.discountForbidden).length;

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-primary" />
            <h1
              className="text-3xl font-extrabold uppercase tracking-[0.04em] text-text"
              style={{ fontFamily: "var(--font-bricolage)" }}
            >
              Governance
            </h1>
          </div>
          <HelpButton pageKey="governance" />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          Categorie mai autonome (§8.2) + vincoli commerciali RF-6.15..6.20. Il codice applica le
          guardie <code>enforced_in_code</code>: le altre sono documentazione operativa.
        </p>
      </header>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-danger">
            <Ban className="h-3.5 w-3.5" /> Mai autonomo
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {neverCount}
          </div>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-warning">
            <UserCheck className="h-3.5 w-3.5" /> Approvazione umana
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {humanReviewCount}
          </div>
        </div>
        <div className="rounded-xl border border-success/30 bg-success/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-success">
            <Zap className="h-3.5 w-3.5" /> Autonomo
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {autoCount}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-text-muted">
            <ShieldAlert className="h-3.5 w-3.5" /> Prodotti no-sconto
          </div>
          <div
            className="mt-1 text-3xl font-bold text-text"
            style={{ fontFamily: "var(--font-bricolage)" }}
          >
            {forbiddenProductCount}
          </div>
        </div>
      </div>

      <GovernanceClient rules={rules} products={products} canCrud={canCrud} />
    </div>
  );
}
