// M08 Reviews repo (RS-1 internal, consumato da actions + fetcher).

import { getAdminClient } from "@/lib/db/admin";
import type { Review, ReviewClassification, ReviewStatus } from "./types";

type ReviewRow = {
  id: string;
  organization_id: string;
  brand_id: string;
  source: "google";
  external_id: string;
  author_name: string | null;
  rating: number;
  text_original: string | null;
  posted_at: string;
  fetched_at: string;
  classification: ReviewClassification;
  classification_reason: string | null;
  suggested_reply: string | null;
  approved_reply: string | null;
  status: ReviewStatus;
  approved_by: string | null;
  approved_at: string | null;
  published_externally_at: string | null;
  resolved_notes: string | null;
  created_at: string;
  updated_at: string;
};

function rowToReview(r: ReviewRow): Review {
  return {
    id: r.id,
    organizationId: r.organization_id,
    brandId: r.brand_id,
    source: r.source,
    externalId: r.external_id,
    authorName: r.author_name,
    rating: r.rating,
    textOriginal: r.text_original,
    postedAt: r.posted_at,
    fetchedAt: r.fetched_at,
    classification: r.classification,
    classificationReason: r.classification_reason,
    suggestedReply: r.suggested_reply,
    approvedReply: r.approved_reply,
    status: r.status,
    approvedBy: r.approved_by,
    approvedAt: r.approved_at,
    publishedExternallyAt: r.published_externally_at,
    resolvedNotes: r.resolved_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export type ListReviewsFilters = {
  brandIds?: string[];
  classifications?: ReviewClassification[];
  statuses?: ReviewStatus[];
};

export async function listReviews(
  organizationId: string,
  filters: ListReviewsFilters = {},
): Promise<Review[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("reviews")
    .select("*")
    .eq("organization_id", organizationId)
    .order("posted_at", { ascending: false });
  if (filters.brandIds?.length) q = q.in("brand_id", filters.brandIds);
  if (filters.classifications?.length) q = q.in("classification", filters.classifications);
  if (filters.statuses?.length) q = q.in("status", filters.statuses);
  const { data, error } = await q;
  if (error) throw new Error(`listReviews: ${error.message}`);
  return ((data ?? []) as ReviewRow[]).map(rowToReview);
}

export async function getReview(organizationId: string, id: string): Promise<Review | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("reviews")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getReview: ${error.message}`);
  return data ? rowToReview(data as ReviewRow) : null;
}

export type StatusCounts = {
  pending: number;
  draftReady: number;
  seriousSignaled: number;
  publishedToday: number;
};

export async function countByStatus(organizationId: string): Promise<StatusCounts> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const [pending, draft, serious, publishedToday] = await Promise.all([
    admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending"),
    admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "draft_ready"),
    admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "serious_signaled"),
    admin
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .gte("published_externally_at", todayIso),
  ]);
  return {
    pending: pending.count ?? 0,
    draftReady: draft.count ?? 0,
    seriousSignaled: serious.count ?? 0,
    publishedToday: publishedToday.count ?? 0,
  };
}

export type InsertReviewFromFetchInput = {
  organizationId: string;
  brandId: string;
  externalId: string;
  authorName: string | null;
  rating: number;
  textOriginal: string | null;
  postedAt: string;
  classification: ReviewClassification;
  classificationReason: string;
};

export async function insertReviewFromFetch(input: InsertReviewFromFetchInput): Promise<Review | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const initialStatus: ReviewStatus =
    input.classification === "serious" ? "serious_signaled" : "pending";
  const { data, error } = await admin
    .from("reviews")
    .upsert(
      {
        organization_id: input.organizationId,
        brand_id: input.brandId,
        source: "google",
        external_id: input.externalId,
        author_name: input.authorName,
        rating: input.rating,
        text_original: input.textOriginal,
        posted_at: input.postedAt,
        classification: input.classification,
        classification_reason: input.classificationReason,
        status: initialStatus,
      },
      { onConflict: "organization_id,source,external_id", ignoreDuplicates: true },
    )
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`insertReviewFromFetch: ${error.message}`);
  return data ? rowToReview(data as ReviewRow) : null;
}

export async function updateReviewDraft(
  organizationId: string,
  id: string,
  suggestedReply: string | null,
  newStatus: ReviewStatus,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("reviews")
    .update({ suggested_reply: suggestedReply, status: newStatus })
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (error) throw new Error(`updateReviewDraft: ${error.message}`);
}

export async function approveReview(
  organizationId: string,
  id: string,
  approvedReply: string,
  approvedBy: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("reviews")
    .update({
      approved_reply: approvedReply,
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      status: "approved",
    })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "draft_ready");
  if (error) throw new Error(`approveReview: ${error.message}`);
}

export async function markReviewPublished(
  organizationId: string,
  id: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("reviews")
    .update({
      status: "published_externally",
      published_externally_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "approved");
  if (error) throw new Error(`markReviewPublished: ${error.message}`);
}

export async function resolveSerious(
  organizationId: string,
  id: string,
  resolvedNotes: string,
): Promise<void> {
  if (resolvedNotes.trim().length < 20) {
    throw new Error("resolvedNotes deve essere almeno 20 caratteri (RF-8.4)");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("reviews")
    .update({
      status: "serious_resolved",
      resolved_notes: resolvedNotes.trim(),
    })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "serious_signaled");
  if (error) throw new Error(`resolveSerious: ${error.message}`);
}

export async function reopenSeriousForDraft(
  organizationId: string,
  id: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("reviews")
    .update({ status: "pending" })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("status", "serious_signaled");
  if (error) throw new Error(`reopenSeriousForDraft: ${error.message}`);
}
