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
} from "./internal/actions";
