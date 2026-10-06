// M06 Fedeltà + Voucher — types.
// Identificatori in inglese, etichette UI in italiano.

export type CounterKind = "passaggi" | "valore_speso" | "ordini";
export type CounterResetMode = "dopo_premio" | "annuale" | "mai";

export type LoyaltyCounter = {
  id: string;
  organizationId: string;
  brandId: string;
  name: string;
  description: string | null;
  kind: CounterKind;
  thresholdCount: number | null;
  thresholdValueCents: number | null;
  resetMode: CounterResetMode;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CounterEvent = {
  id: string;
  organizationId: string;
  counterId: string;
  contactId: string;
  deltaCount: number;
  deltaValueCents: number;
  orderId: string | null;
  occurredAt: string;
  note: string | null;
  createdAt: string;
};

export type RewardKind = "valore_fisso" | "percentuale" | "servizio_gratis";

export type VoucherOffer = {
  id: string;
  organizationId: string;
  issuerBrandId: string;
  spendableBrandId: string;
  counterId: string | null;
  name: string;
  description: string | null;
  rewardKind: RewardKind;
  rewardValueCents: number | null;
  rewardPct: number | null;
  rewardLabel: string | null;
  defaultExpiresDays: number;
  cumulable: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VoucherStatus = "issued" | "redeemed" | "expired" | "cancelled";

export type Voucher = {
  id: string;
  organizationId: string;
  offerId: string;
  contactId: string;
  code: string;
  rewardKind: RewardKind;
  rewardValueCents: number | null;
  rewardPct: number | null;
  rewardLabel: string | null;
  status: VoucherStatus;
  issuedAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedByOrderId: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  notes: string | null;
  sourceDraftId: string | null; // RF-9.3 attribuzione contenuto -> vendita
  createdAt: string;
  updatedAt: string;
};

// UI labels
export const COUNTER_KIND_LABELS: Record<CounterKind, string> = {
  passaggi: "Passaggi (es. lavaggi, visite)",
  valore_speso: "Valore speso in €",
  ordini: "Ordini",
};

export const COUNTER_RESET_LABELS: Record<CounterResetMode, string> = {
  dopo_premio: "Azzera dopo il premio",
  annuale: "Azzera ogni anno",
  mai: "Non azzera",
};

export const REWARD_KIND_LABELS: Record<RewardKind, string> = {
  valore_fisso: "Valore fisso in €",
  percentuale: "Sconto %",
  servizio_gratis: "Servizio/prodotto gratis",
};

export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  issued: "Emesso",
  redeemed: "Riscattato",
  expired: "Scaduto",
  cancelled: "Annullato",
};

// Formatter reward per UI
export function formatReward(
  kind: RewardKind,
  valueCents: number | null,
  pct: number | null,
  label: string | null,
): string {
  if (kind === "valore_fisso" && valueCents !== null) {
    return (valueCents / 100).toLocaleString("it-IT", {
      style: "currency",
      currency: "EUR",
    });
  }
  if (kind === "percentuale" && pct !== null) {
    return `${pct}%`;
  }
  if (kind === "servizio_gratis" && label) {
    return label;
  }
  return "—";
}

import { randomInt } from "node:crypto";

// RNF-1 · RF-6.7: codici voucher devono essere non-predicibili (rappresentano
// valore riscattabile). Usiamo crypto.randomInt (CSPRNG) invece di Math.random.
// Formato: 8 char alfanumerici uppercase, alfabeto ridotto per leggibilita.
export function generateVoucherCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 per leggibilita
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[randomInt(0, chars.length)];
  }
  return code;
}
