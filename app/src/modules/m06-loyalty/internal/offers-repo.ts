// M06 — repo offerte voucher.

import { getAdminClient } from "@/lib/db/admin";
import type { RewardKind, VoucherOffer } from "./loyalty-types";

const SELECT_COLS =
  "id, organization_id, issuer_brand_id, spendable_brand_id, counter_id, name, description, " +
  "reward_kind, reward_value_cents, reward_pct, reward_label, default_expires_days, cumulable, " +
  "is_active, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToOffer(row: any): VoucherOffer {
  return {
    id: row.id,
    organizationId: row.organization_id,
    issuerBrandId: row.issuer_brand_id,
    spendableBrandId: row.spendable_brand_id,
    counterId: row.counter_id ?? null,
    name: row.name,
    description: row.description ?? null,
    rewardKind: row.reward_kind as RewardKind,
    rewardValueCents: row.reward_value_cents ?? null,
    rewardPct: row.reward_pct !== null ? Number(row.reward_pct) : null,
    rewardLabel: row.reward_label ?? null,
    defaultExpiresDays: row.default_expires_days,
    cumulable: row.cumulable,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type OfferRow = VoucherOffer & {
  issuerBrandSlug: string;
  issuerBrandDisplayName: string;
  issuerBrandColor: string;
  spendableBrandSlug: string;
  spendableBrandDisplayName: string;
  spendableBrandColor: string;
};

export async function listOffers(
  organizationId: string,
  includeInactive: boolean = false,
): Promise<OfferRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("voucher_offers")
    .select(
      `${SELECT_COLS}, issuer:brands!voucher_offers_issuer_brand_id_fkey(slug, display_name, color), spendable:brands!voucher_offers_spendable_brand_id_fkey(slug, display_name, color)`,
    )
    .eq("organization_id", organizationId);
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(`Errore lista offerte: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row): OfferRow => ({
    ...rowToOffer(row),
    issuerBrandSlug: row.issuer.slug,
    issuerBrandDisplayName: row.issuer.display_name,
    issuerBrandColor: row.issuer.color,
    spendableBrandSlug: row.spendable.slug,
    spendableBrandDisplayName: row.spendable.display_name,
    spendableBrandColor: row.spendable.color,
  }));
}

export async function getOffer(
  offerId: string,
  organizationId: string,
): Promise<VoucherOffer | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("voucher_offers")
    .select(SELECT_COLS)
    .eq("id", offerId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura offerta: ${error.message}`);
  return data ? rowToOffer(data) : null;
}

export type UpsertOfferInput = {
  organizationId: string;
  offerId?: string;
  issuerBrandId: string;
  spendableBrandId: string;
  counterId?: string | null;
  name: string;
  description?: string | null;
  rewardKind: RewardKind;
  rewardValueCents?: number | null;
  rewardPct?: number | null;
  rewardLabel?: string | null;
  defaultExpiresDays: number;
  cumulable: boolean;
  isActive: boolean;
};

export async function upsertOffer(input: UpsertOfferInput): Promise<VoucherOffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    issuer_brand_id: input.issuerBrandId,
    spendable_brand_id: input.spendableBrandId,
    counter_id: input.counterId ?? null,
    name: input.name.trim(),
    description: input.description ?? null,
    reward_kind: input.rewardKind,
    reward_value_cents: input.rewardValueCents ?? null,
    reward_pct: input.rewardPct ?? null,
    reward_label: input.rewardLabel ?? null,
    default_expires_days: input.defaultExpiresDays,
    cumulable: input.cumulable,
    is_active: input.isActive,
  };
  if (input.offerId) {
    const { data, error } = await admin
      .from("voucher_offers")
      .update(row)
      .eq("id", input.offerId)
      .eq("organization_id", input.organizationId)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore update offerta: ${error.message}`);
    return rowToOffer(data);
  } else {
    const { data, error } = await admin
      .from("voucher_offers")
      .insert(row)
      .select(SELECT_COLS)
      .single();
    if (error) throw new Error(`Errore insert offerta: ${error.message}`);
    return rowToOffer(data);
  }
}
