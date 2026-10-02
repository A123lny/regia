// M09 — repo reminders. Tenant-scoped.

import { getAdminClient } from "@/lib/db/admin";
import type {
  Reminder,
  ReminderChannelHint,
  ReminderKind,
  ReminderReferenceType,
  ReminderStatus,
} from "./reminders-types";

const SELECT_COLS =
  "id, organization_id, brand_id, contact_id, kind, channel_hint, status, " +
  "reference_type, reference_id, scheduled_at, sent_at, dismissed_at, message_hint, notes, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToReminder(row: any): Reminder {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    contactId: row.contact_id,
    kind: row.kind as ReminderKind,
    channelHint: (row.channel_hint as ReminderChannelHint | null) ?? null,
    status: row.status as ReminderStatus,
    referenceType: (row.reference_type as ReminderReferenceType | null) ?? null,
    referenceId: row.reference_id ?? null,
    scheduledAt: row.scheduled_at,
    sentAt: row.sent_at ?? null,
    dismissedAt: row.dismissed_at ?? null,
    messageHint: row.message_hint ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ReminderRow = Reminder & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  contactFullName: string | null;
  contactEmail: string | null;
};

export type ListRemindersInput = {
  organizationId: string;
  brandId?: string;
  kind?: ReminderKind;
  status?: ReminderStatus;
  scheduledBeforeIso?: string;
  limit?: number;
};

export async function listReminders(input: ListRemindersInput): Promise<ReminderRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("reminders")
    .select(
      `${SELECT_COLS}, brands!inner(slug, display_name, color, is_archived), contacts!inner(first_name, last_name, email)`,
    )
    .eq("organization_id", input.organizationId)
    .eq("brands.is_archived", false);
  if (input.brandId) q = q.eq("brand_id", input.brandId);
  if (input.kind) q = q.eq("kind", input.kind);
  if (input.status) q = q.eq("status", input.status);
  if (input.scheduledBeforeIso) q = q.lte("scheduled_at", input.scheduledBeforeIso);
  const { data, error } = await q
    .order("scheduled_at", { ascending: true })
    .limit(input.limit ?? 200);
  if (error) throw new Error(`Errore lista reminders: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((row): ReminderRow => {
    const parts = [row.contacts?.first_name, row.contacts?.last_name].filter(
      (v: string | null | undefined): v is string => Boolean(v),
    );
    return {
      ...rowToReminder(row),
      brandSlug: row.brands.slug as string,
      brandDisplayName: row.brands.display_name as string,
      brandColor: row.brands.color as string,
      contactFullName: parts.length > 0 ? parts.join(" ") : null,
      contactEmail: (row.contacts?.email as string | null) ?? null,
    };
  });
}

export async function getReminder(
  reminderId: string,
  organizationId: string,
): Promise<Reminder | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("reminders")
    .select(SELECT_COLS)
    .eq("id", reminderId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw new Error(`Errore lettura reminder: ${error.message}`);
  return data ? rowToReminder(data) : null;
}

export type ScheduleReminderInput = {
  organizationId: string;
  brandId: string;
  contactId: string;
  kind: ReminderKind;
  channelHint?: ReminderChannelHint | null;
  referenceType?: ReminderReferenceType | null;
  referenceId?: string | null;
  scheduledAtIso?: string;
  messageHint?: string | null;
  notes?: string | null;
};

export type ScheduleReminderResult = {
  created: boolean;
  reminderId: string | null;
};

/**
 * Schedula un reminder rispettando UNIQUE parziale (contact, kind, reference) su pending.
 * - created=true + reminderId=<id> se creato ora
 * - created=false + reminderId=<id del pending esistente> se duplicato idempotente (lookup)
 * - created=false + reminderId=null solo in casi di errore gestito
 */
export async function scheduleReminder(
  input: ScheduleReminderInput,
): Promise<ScheduleReminderResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    contact_id: input.contactId,
    kind: input.kind,
    channel_hint: input.channelHint ?? null,
    status: "pending",
    reference_type: input.referenceType ?? null,
    reference_id: input.referenceId ?? null,
    scheduled_at: input.scheduledAtIso ?? new Date().toISOString(),
    message_hint: input.messageHint ?? null,
    notes: input.notes ?? null,
  };
  const { data, error } = await admin.from("reminders").insert(row).select("id").single();
  if (error) {
    if (error.code === "23505") {
      // Idempotente: cerco il reminder pending esistente (stesso contact+kind+reference).
      let q = admin
        .from("reminders")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("contact_id", input.contactId)
        .eq("kind", input.kind)
        .eq("status", "pending");
      if (input.referenceId) q = q.eq("reference_id", input.referenceId);
      const { data: existing } = await q.limit(1).maybeSingle();
      return { created: false, reminderId: (existing as { id: string } | null)?.id ?? null };
    }
    throw new Error(`Errore schedule reminder: ${error.message}`);
  }
  return { created: true, reminderId: (data as { id: string }).id };
}

export async function markReminderSent(
  reminderId: string,
  organizationId: string,
): Promise<Reminder | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("reminders")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", reminderId)
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore mark sent: ${error.message}`);
  return data ? rowToReminder(data) : null;
}

export async function dismissReminder(
  reminderId: string,
  organizationId: string,
): Promise<Reminder | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("reminders")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", reminderId)
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore dismiss: ${error.message}`);
  return data ? rowToReminder(data) : null;
}

export async function getRemindersStats(organizationId: string): Promise<{
  pendingToday: number;
  pendingWeek: number;
  sentLast30d: number;
  dismissedLast30d: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const now = new Date();
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
  ).toISOString();
  const weekEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [todayRes, weekRes, sentRes, dismissedRes] = await Promise.all([
    admin
      .from("reminders")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .lte("scheduled_at", todayEnd),
    admin
      .from("reminders")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .lte("scheduled_at", weekEnd),
    admin
      .from("reminders")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "sent")
      .gte("sent_at", thirtyDaysAgo),
    admin
      .from("reminders")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "dismissed")
      .gte("dismissed_at", thirtyDaysAgo),
  ]);

  if (todayRes.error) throw new Error(`Stats today: ${todayRes.error.message}`);
  if (weekRes.error) throw new Error(`Stats week: ${weekRes.error.message}`);
  if (sentRes.error) throw new Error(`Stats sent: ${sentRes.error.message}`);
  if (dismissedRes.error) throw new Error(`Stats dismissed: ${dismissedRes.error.message}`);

  return {
    pendingToday: todayRes.count ?? 0,
    pendingWeek: weekRes.count ?? 0,
    sentLast30d: sentRes.count ?? 0,
    dismissedLast30d: dismissedRes.count ?? 0,
  };
}
