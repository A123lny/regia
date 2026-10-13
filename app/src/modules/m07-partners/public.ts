// M07 Partners — interfaccia pubblica (RS-1).

export type {
  PartnerRestaurant,
  PartnerActivity,
  OnboardingStatus,
  ActivityKind,
  ActivityOutcome,
} from "./internal/partners-types";

export {
  ONBOARDING_STATUS_LABELS,
  ACTIVITY_KIND_LABELS,
  ACTIVITY_OUTCOME_LABELS,
  daysSinceLastContact,
} from "./internal/partners-types";

export { listPartners, getPartner, getPartnerStats } from "./internal/partners-repo";
export type { ListPartnersInput } from "./internal/partners-repo";

export { listActivitiesByPartner, listRecentContactActivities } from "./internal/activities-repo";
export type { RecentContactActivity } from "./internal/activities-repo";

export {
  upsertPartnerAction,
  archivePartnerAction,
  logActivityAction,
  toggleCoolingAction,
  generateMonthlyReportAction,
  getLaunchStatusAction,
  updateLaunchNotesAction,
  recordDeliveryErrorAction,
  getPartnerErrorsAction,
} from "./internal/actions";
export type {
  UpsertPartnerActionInput,
  LogActivityActionInput,
  ToggleCoolingActionInput,
  GenerateMonthlyReportInput,
  GenerateMonthlyReportResult,
  GetLaunchStatusResult,
  UpdateLaunchNotesInput,
  RecordDeliveryErrorActionInput,
  RecordDeliveryErrorActionResult,
  GetPartnerErrorsResult,
} from "./internal/actions";

// RN-47 Report mensile ristoratori
export type { MonthlyPartnerReport } from "./internal/monthly-report-builder";

// RN-48 Workflow lancio nuovo ristorante
export { LAUNCH_WINDOW_DAYS } from "./internal/launch-tracker";
export type { PartnerLaunchStatus } from "./internal/launch-tracker";

// RN-28 Errori consegna ristorante
export { SEVERITY_LABELS, SEVERITY_STYLES } from "./internal/delivery-errors-repo";
export type {
  DeliveryError,
  DeliveryErrorSeverity,
  PartnerErrorsSummary,
} from "./internal/delivery-errors-repo";

// RN-37/38/39 Analisi mercato per categoria
export { analyzeMarketByCategory } from "./internal/market-analysis";
export type { MarketAnalysis, MarketCategoryRow } from "./internal/market-analysis";
