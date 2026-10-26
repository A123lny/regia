// Orchestratore fetch: cicla brand con google_place_id, invoca adapter,
// classifica e inserisce con ON CONFLICT DO NOTHING (idempotente).

import { getAdminClient } from "@/lib/db/admin";
import { classifyReview } from "./classifier";
import { insertReviewFromFetch } from "./reviews-repo";
import type { GoogleReviewsFetcher } from "./google-places-adapter";
import { generateDraftForReview } from "./draft-generator";

export type FetchSummary = {
  brandsScanned: number;
  reviewsFetched: number;
  newInserted: number;
  errors: Array<{ brandId: string; message: string }>;
};

export async function fetchAllBrandsReviews(
  organizationId: string,
  fetcher: GoogleReviewsFetcher,
): Promise<FetchSummary> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: brands, error } = await admin
    .from("brands")
    .select("id, google_place_id")
    .eq("organization_id", organizationId)
    .not("google_place_id", "is", null);
  if (error) throw new Error(`fetchAllBrandsReviews brands: ${error.message}`);

  const summary: FetchSummary = {
    brandsScanned: 0,
    reviewsFetched: 0,
    newInserted: 0,
    errors: [],
  };
  for (const brand of (brands ?? []) as { id: string; google_place_id: string }[]) {
    summary.brandsScanned++;
    try {
      const externals = await fetcher.fetchReviews(brand.google_place_id);
      summary.reviewsFetched += externals.length;
      for (const ext of externals) {
        const { classification, reason } = classifyReview(ext.rating, ext.text);
        const inserted = await insertReviewFromFetch({
          organizationId,
          brandId: brand.id,
          externalId: ext.externalId,
          authorName: ext.authorName,
          rating: ext.rating,
          textOriginal: ext.text,
          postedAt: ext.postedAt,
          classification,
          classificationReason: reason,
        });
        if (inserted) {
          summary.newInserted++;
          if (classification !== "serious") {
            // Fire-and-forget: generiamo la bozza senza bloccare il fetch.
            // In produzione F0 è sincrono (no coda); per volumi F0 va bene.
            void generateDraftForReview(organizationId, inserted.id).catch((e) => {
              summary.errors.push({
                brandId: brand.id,
                message: `draft gen fallita: ${e instanceof Error ? e.message : String(e)}`,
              });
            });
          }
        }
      }
    } catch (e) {
      summary.errors.push({
        brandId: brand.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return summary;
}
