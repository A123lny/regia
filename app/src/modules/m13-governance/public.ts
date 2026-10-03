// M13 Governance — interfaccia pubblica (RS-1).

export type {
  AutonomyLevel,
  AutonomyRule,
  ProductDiscountForbidden,
} from "./internal/governance-types";

export {
  AUTONOMY_LEVEL_LABELS,
  AUTONOMY_LEVEL_STYLES,
  CommercialGuardError,
} from "./internal/governance-types";

export {
  listAutonomyRules,
  getAutonomyRuleByKind,
  listAllProductsWithDiscountFlag,
} from "./internal/autonomy-repo";
export type { DiscountForbiddenProduct } from "./internal/autonomy-repo";

// Validatori riusabili (chiamati da m06 etc.)
export {
  findForbiddenProductsInBrand,
  validateOfferAgainstCommercialRules,
} from "./internal/commercial-guards";

// Server actions
export { updateAutonomyRuleAction, toggleProductDiscountForbiddenAction } from "./internal/actions";

// RF-13.x Advertising
export {
  listAdvertisingBudgets,
  getAdvertisingBudget,
  listOverrunRequests,
  AD_CATEGORY_LABELS,
  AD_CLASSIFICATION_LABELS,
} from "./internal/advertising-repo";
export type {
  AdCategory,
  AdClassification,
  AdvertisingBudget,
  AdvertisingBudgetWithSpend,
  OverrunRequest,
  OverrunRequestRow,
} from "./internal/advertising-repo";
export {
  upsertAdvertisingBudgetAction,
  toggleAdvertisingCategoryAction,
  classifyDraftForAdvertisingAction,
  requestAdvertisingOverrunAction,
  decideAdvertisingOverrunAction,
  upsertDeliveryZoneAction,
  deleteDeliveryZoneAction,
  openBlackoutAction,
  closeBlackoutAction,
} from "./internal/actions";

// RN-52 Zone consegna
export {
  listDeliveryZones,
  isContactInBlackoutZone,
  assertDeliveryZonesOk,
  DeliveryZoneBlackoutError,
  BLACKOUT_KIND_LABELS,
} from "./internal/delivery-zones-repo";
export type {
  DeliveryZone,
  DeliveryZoneRow,
  ActiveBlackout,
  DeliveryBlackoutKind,
  BlackoutCheck,
} from "./internal/delivery-zones-repo";

// RF-6.18 + RN-41..43 Capacita rider
export {
  listRiderCapacityWindows,
  listRiderShiftRequests,
  checkRiderCapacityForSlot,
  assertRiderCapacityOk,
  RiderCapacityExceededError,
  WEEKDAY_LABELS,
} from "./internal/rider-capacity-repo";
export type {
  Weekday,
  RiderCapacityWindow,
  RiderCapacityWindowRow,
  RiderShiftRequest,
  RiderShiftRequestRow,
  ShiftRequestStatus,
  CapacityCheckResult,
} from "./internal/rider-capacity-repo";
export {
  upsertRiderCapacityWindowAction,
  updateRiderCapacityFilledAction,
  deleteRiderCapacityWindowAction,
  createRiderShiftRequestAction,
  fulfillRiderShiftRequestAction,
  cancelRiderShiftRequestAction,
} from "./internal/actions";
