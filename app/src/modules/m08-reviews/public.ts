// M08 Reviews - interfaccia pubblica (RS-1).

export type {
  Review,
  ReviewSource,
  ReviewClassification,
  ReviewStatus,
} from "./internal/types";

export { CLASSIFICATION_LABELS, STATUS_LABELS } from "./internal/types";

export { classifyReview, GRAVE_KEYWORDS } from "./internal/classifier";

export {
  listReviews,
  getReview,
  countByStatus,
} from "./internal/reviews-repo";
export type { ListReviewsFilters, StatusCounts } from "./internal/reviews-repo";
