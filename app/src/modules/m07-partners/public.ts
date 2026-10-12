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

export { listActivitiesByPartner } from "./internal/activities-repo";

export {
  upsertPartnerAction,
  archivePartnerAction,
  logActivityAction,
  toggleCoolingAction,
  generateMonthlyReportAction,
} from "./internal/actions";
export type {
  UpsertPartnerActionInput,
  LogActivityActionInput,
  ToggleCoolingActionInput,
  GenerateMonthlyReportInput,
  GenerateMonthlyReportResult,
} from "./internal/actions";

// RN-47 Report mensile ristoratori
export type { MonthlyPartnerReport } from "./internal/monthly-report-builder";
