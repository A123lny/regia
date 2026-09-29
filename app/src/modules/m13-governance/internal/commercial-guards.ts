// M13 — validatori commerciali RF-6.15..6.20.
// Chiamati dalle actions di altri moduli (m06 offer, m07-outreach campagne).

import { getAdminClient } from "@/lib/db/admin";
import { findProductsWithoutPartnerConsent } from "@/modules/m01-data-hub/public";
import { CommercialGuardError } from "./governance-types";

/**
 * RF-6.15/6.17 — verifica che almeno un prodotto del brand spendibile abbia
 * `discount_forbidden=true` E che l'offerta sia genericamente applicabile
 * (voucher a valore fisso / percentuale). In F1 non abbiamo un binding offer→prodotto,
 * quindi la guardia è INFORMATIVA: segnala che il brand ha prodotti "no sconto"
 * e richiede conferma esplicita dell'operatore.
 *
 * Ritorna la lista dei prodotti flagged. Se non vuota, il chiamante decide se
 * bloccare (Owner con confirm=true) o rifiutare l'operazione.
 */
export async function findForbiddenProductsInBrand(
  organizationId: string,
  brandId: string,
): Promise<Array<{ sku: string; name: string; reason: string | null }>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_products")
    .select("sku, name, discount_forbidden_reason")
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .eq("discount_forbidden", true)
    .is("archived_at", null);
  if (error) throw new Error(`Errore lookup forbidden: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({
    sku: r.sku as string,
    name: r.name as string,
    reason: (r.discount_forbidden_reason as string | null) ?? null,
  }));
}

/**
 * Validatore per creazione/aggiornamento offerta voucher (m06).
 * RF-6.15..6.17: se la spendable brand ha prodotti con `discount_forbidden=true`
 * e l'offerta è tipo "valore_fisso"/"percentuale", il codice segnala la violazione
 * potenziale — a meno che confirmOverride sia true (Owner deve confermare esplicitamente).
 *
 * Throws CommercialGuardError se blocco.
 */
export async function validateOfferAgainstCommercialRules(input: {
  organizationId: string;
  spendableBrandId: string;
  rewardKind: string;
  confirmOverride?: boolean;
}): Promise<void> {
  // Solo reward "monetari" (fisso o %) sono a rischio — servizio_gratis lascia gestione al riscatto
  if (input.rewardKind !== "valore_fisso" && input.rewardKind !== "percentuale") {
    return;
  }

  // RF-6.19: se brand spendibile ha prodotti di partner senza assenso → blocca
  const noConsent = await findProductsWithoutPartnerConsent(
    input.organizationId,
    input.spendableBrandId,
  );
  if (noConsent.length > 0 && !input.confirmOverride) {
    const first = noConsent[0]!;
    throw new CommercialGuardError(
      `RF-6.19: il brand contiene prodotti del partner "${first.partnerName}" (${first.sku}) senza assenso alle promozioni. Richiedi l'assenso al partner o attiva l'override.`,
      "sconti_partner_senza_assenso",
      first.sku,
    );
  }

  const forbidden = await findForbiddenProductsInBrand(
    input.organizationId,
    input.spendableBrandId,
  );
  if (forbidden.length === 0) return;
  if (input.confirmOverride) return;

  const skuList = forbidden
    .map((p) => `${p.sku} (${p.name})`)
    .slice(0, 3)
    .join(", ");
  const extra = forbidden.length > 3 ? ` e altri ${forbidden.length - 3}` : "";
  throw new CommercialGuardError(
    `Il marchio spendibile contiene prodotti a sconto vietato (RF-6.15/6.17): ${skuList}${extra}. Rivedi la scope dell'offerta o marca l'override con conferma esplicita.`,
    "sconti_carburante_o_officina",
    forbidden[0]?.sku ?? "?",
  );
}
