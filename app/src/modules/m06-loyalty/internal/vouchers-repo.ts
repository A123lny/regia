// M06 — repo voucher (RF-6.24 scheda unica, RF-6.26 uso singolo).

import { getAdminClient } from "@/lib/db/admin";
import type { RewardKind, Voucher, VoucherStatus } from "./loyalty-types";

const SELECT_COLS =
  "id, organization_id, offer_id, contact_id, code, reward_kind, reward_value_cents, reward_pct, reward_label, " +
  "status, issued_at, expires_at, redeemed_at, redeemed_by_order_id, cancelled_at, cancelled_reason, notes, source_draft_id, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToVoucher(row: any): Voucher {
  return {
    id: row.id,
    organizationId: row.organization_id,
    offerId: row.offer_id,
    contactId: row.contact_id,
    code: row.code,
    rewardKind: row.reward_kind as RewardKind,
    rewardValueCents: row.reward_value_cents ?? null,
    rewardPct: row.reward_pct !== null ? Number(row.reward_pct) : null,
    rewardLabel: row.reward_label ?? null,
    status: row.status as VoucherStatus,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at ?? null,
    redeemedByOrderId: row.redeemed_by_order_id ?? null,
    cancelledAt: row.cancelled_at ?? null,
    cancelledReason: row.cancelled_reason ?? null,
    notes: row.notes ?? null,
    sourceDraftId: row.source_draft_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type VoucherRow = Voucher & {
  offerName: string;
  contactFullName: string | null;
  contactEmail: string | null;
};

export type ListVouchersInput = {
  organizationId: string;
  contactId?: string;
  status?: VoucherStatus;
  offerId?: string;
  query?: string; // ricerca codice
  limit?: number;
  offset?: number;
};

export async function listVouchers(
  input: ListVouchersInput,
): Promise<{ items: VoucherRow[]; totalCount: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("vouchers")
    .select(
      `${SELECT_COLS}, voucher_offers!inner(name), contacts!inner(first_name, last_name, email)`,
      { count: "exact" },
    )
    .eq("organization_id", input.organizationId);

  if (input.contactId) q = q.eq("contact_id", input.contactId);
  if (input.status) q = q.eq("status", input.status);
  if (input.offerId) q = q.eq("offer_id", input.offerId);
  if (input.query && input.query.trim().length > 0) {
    q = q.ilike("code", `%${input.query.trim()}%`);
  }

  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  q = q.order("issued_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await q;
  if (error) throw new Error(`Errore lista voucher: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = ((data ?? []) as any[]).map((row): VoucherRow => {
    const first = row.contacts?.first_name as string | null | undefined;
    const last = row.contacts?.last_name as string | null | undefined;
    const parts = [first, last].filter((v): v is string => Boolean(v));
    return {
      ...rowToVoucher(row),
      offerName: row.voucher_offers.name as string,
      contactFullName: parts.length > 0 ? parts.join(" ") : null,
      contactEmail: (row.contacts?.email as string | null) ?? null,
    };
  });
  return { items, totalCount: count ?? items.length };
}

export async function getVoucher(
  voucherId: string,
  organizationId: string,
): Promise<Voucher | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("vouchers")
    .select(SELECT_COLS)
    .eq("id", voucherId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura voucher: ${error.message}`);
  return data ? rowToVoucher(data) : null;
}

export async function getVoucherByCode(
  code: string,
  organizationId: string,
): Promise<Voucher | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("vouchers")
    .select(SELECT_COLS)
    .eq("code", code)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lookup codice: ${error.message}`);
  return data ? rowToVoucher(data) : null;
}

export type IssueVoucherInput = {
  organizationId: string;
  offerId: string;
  contactId: string;
  code: string;
  rewardKind: RewardKind;
  rewardValueCents?: number | null;
  rewardPct?: number | null;
  rewardLabel?: string | null;
  expiresAtIso: string;
  notes?: string | null;
  sourceDraftId?: string | null; // RF-9.3 attribuzione
};

export async function insertVoucher(input: IssueVoucherInput): Promise<Voucher> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    offer_id: input.offerId,
    contact_id: input.contactId,
    code: input.code,
    reward_kind: input.rewardKind,
    reward_value_cents: input.rewardValueCents ?? null,
    reward_pct: input.rewardPct ?? null,
    reward_label: input.rewardLabel ?? null,
    status: "issued",
    expires_at: input.expiresAtIso,
    notes: input.notes ?? null,
    source_draft_id: input.sourceDraftId ?? null,
  };
  const { data, error } = await admin.from("vouchers").insert(row).select(SELECT_COLS).single();
  if (error) throw new Error(`Errore emissione voucher: ${error.message}`);
  return rowToVoucher(data);
}

/**
 * Riscatto atomico: passa da 'issued' a 'redeemed' con guardia status='issued'.
 * Ritorna il voucher aggiornato o null se già riscattato/annullato/scaduto.
 * RF-6.26 uso singolo: la guardia .eq("status","issued") impedisce doppio riscatto.
 */
export async function redeemVoucherAtomic(
  voucherId: string,
  organizationId: string,
  orderId: string | null,
): Promise<Voucher | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = {
    status: "redeemed",
    redeemed_at: new Date().toISOString(),
    redeemed_by_order_id: orderId,
  };
  const { data, error } = await admin
    .from("vouchers")
    .update(patch)
    .eq("id", voucherId)
    .eq("organization_id", organizationId)
    .eq("status", "issued")
    .gt("expires_at", new Date().toISOString())
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore riscatto voucher: ${error.message}`);
  return data ? rowToVoucher(data) : null;
}

export async function cancelVoucher(
  voucherId: string,
  organizationId: string,
  reason: string,
): Promise<Voucher | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
    cancelled_reason: reason,
  };
  const { data, error } = await admin
    .from("vouchers")
    .update(patch)
    .eq("id", voucherId)
    .eq("organization_id", organizationId)
    .eq("status", "issued")
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore annullamento voucher: ${error.message}`);
  return data ? rowToVoucher(data) : null;
}

/**
 * Statistiche riepilogo per pagina.
 */
export async function getVoucherStats(organizationId: string): Promise<{
  activeIssued: number;
  redeemedTotal: number;
  expiringNext7d: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const now = new Date().toISOString();
  const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const [aRes, rRes, eRes] = await Promise.all([
    admin
      .from("vouchers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "issued")
      .gt("expires_at", now),
    admin
      .from("vouchers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "redeemed"),
    admin
      .from("vouchers")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "issued")
      .gt("expires_at", now)
      .lt("expires_at", in7),
  ]);
  if (aRes.error) throw new Error(`Errore stats voucher: ${aRes.error.message}`);
  if (rRes.error) throw new Error(`Errore stats redeemed: ${rRes.error.message}`);
  if (eRes.error) throw new Error(`Errore stats expiring: ${eRes.error.message}`);
  return {
    activeIssued: aRes.count ?? 0,
    redeemedTotal: rRes.count ?? 0,
    expiringNext7d: eRes.count ?? 0,
  };
}
