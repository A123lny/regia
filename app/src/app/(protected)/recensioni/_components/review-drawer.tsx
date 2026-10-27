// Stub drawer — implementazione reale in Task 12.

import type { Review } from "@/modules/m08-reviews/public";
import type { Brand } from "@/modules/m02-brand/public";

export function ReviewDrawer({}: {
  review: Review | null;
  brand: Brand | null;
  onClose: () => void;
}) {
  return null;
}
