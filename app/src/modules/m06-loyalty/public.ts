// M06 Fedeltà + Voucher — interfaccia pubblica (RS-1).

// Types
export type {
  LoyaltyCounter,
  CounterEvent,
  VoucherOffer,
  Voucher,
  CounterKind,
  CounterResetMode,
  RewardKind,
  VoucherStatus,
} from "./internal/loyalty-types";

export {
  COUNTER_KIND_LABELS,
  COUNTER_RESET_LABELS,
  REWARD_KIND_LABELS,
  VOUCHER_STATUS_LABELS,
  formatReward,
  generateVoucherCode,
} from "./internal/loyalty-types";

// Queries
export {
  listCounters,
  getCounter,
  getContactCounterProgress,
  recordCounterEvent,
} from "./internal/counters-repo";

export { listOffers, getOffer } from "./internal/offers-repo";
export type { OfferRow } from "./internal/offers-repo";

export {
  listVouchers,
  getVoucher,
  getVoucherByCode,
  getVoucherStats,
} from "./internal/vouchers-repo";
export type { VoucherRow, ListVouchersInput } from "./internal/vouchers-repo";

// Server actions
export {
  upsertCounterAction,
  upsertOfferAction,
  issueVoucherAction,
  redeemVoucherAction,
  redeemVoucherByCodeAction,
  cancelVoucherAction,
} from "./internal/actions";
export type {
  UpsertCounterActionInput,
  UpsertOfferActionInput,
  IssueVoucherActionInput,
} from "./internal/actions";

// System-level emissione voucher (usato da m10-signup per landing pubbliche)
export { issueVoucherForSignup } from "./internal/system-issue";
export type { IssueSystemVoucherInput, IssueSystemVoucherResult } from "./internal/system-issue";
