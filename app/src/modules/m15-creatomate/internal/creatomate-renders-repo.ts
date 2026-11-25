// M15 Creatomate — persistenza dei render video/immagine.

import { getAdminClient } from "@/lib/db/admin";

export type CreatomateRenderStatus =
  "queued" | "planned" | "rendering" | "succeeded" | "failed" | "cancelled";

export type CreatomateRenderRow = {
  id: string;
  organizationId: string;
  brandId: string;
  draftId: string | null;
  externalId: string;
  templateId: string;
  modifications: Record<string, unknown>;
  status: CreatomateRenderStatus;
  outputUrl: string | null;
  snapshotUrl: string | null;
  outputFormat: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  errorMessage: string | null;
  assetId: string | null;
  webhookToken: string;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
  succeededAt: string | null;
  failedAt: string | null;
};

const SELECT_COLS =
  "id, organization_id, brand_id, draft_id, external_id, template_id, modifications, " +
  "status, output_url, snapshot_url, output_format, width, height, duration_seconds, " +
  "error_message, asset_id, webhook_token, requested_by, created_at, updated_at, " +
  "succeeded_at, failed_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRender(r: any): CreatomateRenderRow {
  return {
    id: r.id,
    organizationId: r.organization_id,
    brandId: r.brand_id,
    draftId: r.draft_id ?? null,
    externalId: r.external_id,
    templateId: r.template_id,
    modifications: (r.modifications ?? {}) as Record<string, unknown>,
    status: r.status as CreatomateRenderStatus,
    outputUrl: r.output_url ?? null,
    snapshotUrl: r.snapshot_url ?? null,
    outputFormat: r.output_format ?? null,
    width: r.width ?? null,
    height: r.height ?? null,
    durationSeconds: r.duration_seconds ? Number(r.duration_seconds) : null,
    errorMessage: r.error_message ?? null,
    assetId: r.asset_id ?? null,
    webhookToken: r.webhook_token,
    requestedBy: r.requested_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    succeededAt: r.succeeded_at ?? null,
    failedAt: r.failed_at ?? null,
  };
}

export async function insertCreatomateRender(input: {
  organizationId: string;
  brandId: string;
  draftId?: string | null;
  externalId: string;
  templateId: string;
  modifications: Record<string, unknown>;
  webhookToken: string;
  requestedBy: string;
  initialStatus?: CreatomateRenderStatus;
}): Promise<CreatomateRenderRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("creatomate_renders")
    .insert({
      organization_id: input.organizationId,
      brand_id: input.brandId,
      draft_id: input.draftId ?? null,
      external_id: input.externalId,
      template_id: input.templateId,
      modifications: input.modifications,
      status: input.initialStatus ?? "queued",
      webhook_token: input.webhookToken,
      requested_by: input.requestedBy,
    })
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`insertCreatomateRender: ${error.message}`);
  return rowToRender(data);
}

export async function updateRenderStatus(input: {
  externalId: string;
  status: CreatomateRenderStatus;
  outputUrl?: string | null;
  snapshotUrl?: string | null;
  outputFormat?: string | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  errorMessage?: string | null;
  assetId?: string | null;
}): Promise<CreatomateRenderRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = { status: input.status };
  if (input.outputUrl !== undefined) patch["output_url"] = input.outputUrl;
  if (input.snapshotUrl !== undefined) patch["snapshot_url"] = input.snapshotUrl;
  if (input.outputFormat !== undefined) patch["output_format"] = input.outputFormat;
  if (input.width !== undefined) patch["width"] = input.width;
  if (input.height !== undefined) patch["height"] = input.height;
  if (input.durationSeconds !== undefined) patch["duration_seconds"] = input.durationSeconds;
  if (input.errorMessage !== undefined) patch["error_message"] = input.errorMessage;
  if (input.assetId !== undefined) patch["asset_id"] = input.assetId;
  if (input.status === "succeeded") patch["succeeded_at"] = new Date().toISOString();
  if (input.status === "failed") patch["failed_at"] = new Date().toISOString();

  const { data, error } = await admin
    .from("creatomate_renders")
    .update(patch)
    .eq("external_id", input.externalId)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`updateRenderStatus: ${error.message}`);
  return data ? rowToRender(data) : null;
}

export async function getRenderByExternalId(
  externalId: string,
): Promise<CreatomateRenderRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("creatomate_renders")
    .select(SELECT_COLS)
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) throw new Error(`getRenderByExternalId: ${error.message}`);
  return data ? rowToRender(data) : null;
}

export async function getRenderById(
  renderId: string,
  organizationId: string,
): Promise<CreatomateRenderRow | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("creatomate_renders")
    .select(SELECT_COLS)
    .eq("id", renderId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`getRenderById: ${error.message}`);
  return data ? rowToRender(data) : null;
}

export async function listRecentRendersByBrand(
  organizationId: string,
  brandId: string,
  limit: number = 20,
): Promise<CreatomateRenderRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("creatomate_renders")
    .select(SELECT_COLS)
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRecentRendersByBrand: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToRender);
}
