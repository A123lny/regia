// Repo job video fal.ai.

import { getAdminClient } from "@/lib/db/admin";

export type FalVideoJobStatus = "queued" | "in_progress" | "succeeded" | "failed";

export type FalVideoJobRow = {
  id: string;
  organizationId: string;
  brandId: string;
  draftId: string | null;
  requestId: string;
  modelId: string;
  prompt: string;
  imageUrl: string;
  status: FalVideoJobStatus;
  outputUrl: string | null;
  durationSeconds: number | null;
  errorMessage: string | null;
  assetId: string | null;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
  succeededAt: string | null;
  failedAt: string | null;
};

const SELECT_COLS =
  "id, organization_id, brand_id, draft_id, request_id, model_id, prompt, image_url, " +
  "status, output_url, duration_seconds, error_message, asset_id, requested_by, " +
  "created_at, updated_at, succeeded_at, failed_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToJob(r: any): FalVideoJobRow {
  return {
    id: r.id,
    organizationId: r.organization_id,
    brandId: r.brand_id,
    draftId: r.draft_id ?? null,
    requestId: r.request_id,
    modelId: r.model_id,
    prompt: r.prompt,
    imageUrl: r.image_url,
    status: r.status as FalVideoJobStatus,
    outputUrl: r.output_url ?? null,
    durationSeconds: r.duration_seconds ? Number(r.duration_seconds) : null,
    errorMessage: r.error_message ?? null,
    assetId: r.asset_id ?? null,
    requestedBy: r.requested_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    succeededAt: r.succeeded_at ?? null,
    failedAt: r.failed_at ?? null,
  };
}

export async function insertFalVideoJob(input: {
  organizationId: string;
  brandId: string;
  draftId?: string | null;
  requestId: string;
  modelId: string;
  prompt: string;
  imageUrl: string;
  requestedBy: string;
}): Promise<FalVideoJobRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("fal_video_jobs")
    .insert({
      organization_id: input.organizationId,
      brand_id: input.brandId,
      draft_id: input.draftId ?? null,
      request_id: input.requestId,
      model_id: input.modelId,
      prompt: input.prompt,
      image_url: input.imageUrl,
      requested_by: input.requestedBy,
    })
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`insertFalVideoJob: ${error.message}`);
  return rowToJob(data);
}

export async function getFalVideoJobById(
  jobId: string,
  organizationId: string,
): Promise<FalVideoJobRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("fal_video_jobs")
    .select(SELECT_COLS)
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`getFalVideoJobById: ${error.message}`);
  return data ? rowToJob(data) : null;
}

export async function updateFalVideoJobStatus(input: {
  jobId: string;
  status: FalVideoJobStatus;
  outputUrl?: string | null;
  durationSeconds?: number | null;
  errorMessage?: string | null;
  assetId?: string | null;
}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = { status: input.status };
  if (input.outputUrl !== undefined) patch["output_url"] = input.outputUrl;
  if (input.durationSeconds !== undefined) patch["duration_seconds"] = input.durationSeconds;
  if (input.errorMessage !== undefined) patch["error_message"] = input.errorMessage;
  if (input.assetId !== undefined) patch["asset_id"] = input.assetId;
  if (input.status === "succeeded") patch["succeeded_at"] = new Date().toISOString();
  if (input.status === "failed") patch["failed_at"] = new Date().toISOString();
  const { error } = await admin.from("fal_video_jobs").update(patch).eq("id", input.jobId);
  if (error) throw new Error(`updateFalVideoJobStatus: ${error.message}`);
}
