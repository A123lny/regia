// M13 Governance — types §8.2 + RF-6.15..6.20.

export type AutonomyLevel = "never" | "human_review" | "auto";

export type AutonomyRule = {
  id: string;
  organizationId: string;
  kind: string;
  title: string;
  description: string;
  level: AutonomyLevel;
  enforcedInCode: boolean;
  referenceIds: string[];
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export const AUTONOMY_LEVEL_LABELS: Record<AutonomyLevel, string> = {
  never: "Mai autonomo",
  human_review: "Approvazione umana",
  auto: "Autonomo",
};

export const AUTONOMY_LEVEL_STYLES: Record<AutonomyLevel, string> = {
  never: "border-danger/40 bg-danger/15 text-danger",
  human_review: "border-warning/40 bg-warning/15 text-warning",
  auto: "border-success/40 bg-success/15 text-success",
};

export type ProductDiscountForbidden = {
  id: string;
  organizationId: string;
  brandId: string;
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  sku: string;
  name: string;
  category: string;
  discountForbidden: boolean;
  discountForbiddenReason: string | null;
};

// Errore custom per validazione guardie commerciali (RF-6.15..6.17)
export class CommercialGuardError extends Error {
  constructor(
    message: string,
    public readonly ruleKind: string,
    public readonly productSku: string,
  ) {
    super(message);
    this.name = "CommercialGuardError";
  }
}
