// M03 — RF-3.4 Repository ricorrenze annuali.
// Tenant-scoped su organization_id. Le ricorrenze "in finestra" sono quelle
// dove today <= data_evento_anno_corrente <= today+lead_time_days.

import { getAdminClient } from "@/lib/db/admin";

export type RecurringEventKind = "holiday" | "seasonal" | "business";

export type RecurringEvent = {
  id: string;
  organizationId: string;
  brandId: string;
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  name: string;
  kind: RecurringEventKind;
  monthOfYear: number; // 1-12
  dayOfMonth: number; // 1-31
  leadTimeDays: number;
  suggestedTheme: string;
  isActive: boolean;
  createdAt: string;
};

export type UpcomingRecurrence = RecurringEvent & {
  occurrenceDateIso: string; // data reale dell'evento nell'anno corrente (o prossimo se gia passato)
  daysUntil: number; // giorni da oggi all'evento
  yearTag: string; // "2026" — usato per taggare draft come [RICORRENZA:<slug>:<yearTag>]
  alreadyDrafted: boolean; // true se esiste gia un draft con quel tag
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEvent(row: any): RecurringEvent {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    brandSlug: row.brands.slug,
    brandDisplayName: row.brands.display_name,
    brandColor: row.brands.color,
    name: row.name,
    kind: row.kind as RecurringEventKind,
    monthOfYear: row.month_of_year,
    dayOfMonth: row.day_of_month,
    leadTimeDays: row.lead_time_days,
    suggestedTheme: row.suggested_theme,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function listActiveRecurrences(organizationId: string): Promise<RecurringEvent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_recurring_events")
    .select(
      "id, organization_id, brand_id, name, kind, month_of_year, day_of_month, lead_time_days, suggested_theme, is_active, created_at, brands!inner(slug, display_name, color, is_archived)",
    )
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("brands.is_archived", false)
    .order("month_of_year")
    .order("day_of_month");
  if (error) throw new Error(`Errore lettura ricorrenze: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToEvent);
}

/**
 * Ricorrenze "in finestra": eventi dove la data ricorrenza dell'anno corrente
 * cade tra oggi e oggi+lead_time_days. Se la data e gia passata quest'anno,
 * la sposta all'anno prossimo (ma allora non e in finestra a meno che il
 * lead_time sia molto lungo — es. gennaio riguardo natale dell'anno prossimo).
 */
export async function listUpcomingRecurrences(
  organizationId: string,
): Promise<UpcomingRecurrence[]> {
  const events = await listActiveRecurrences(organizationId);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const currentYear = now.getFullYear();

  const upcoming: UpcomingRecurrence[] = [];

  for (const ev of events) {
    // Cerca l'occorrenza nell'anno corrente
    let occurrence = new Date(currentYear, ev.monthOfYear - 1, ev.dayOfMonth);
    let year = currentYear;
    if (occurrence.getTime() < today.getTime()) {
      // Gia passata, prendi prossimo anno
      occurrence = new Date(currentYear + 1, ev.monthOfYear - 1, ev.dayOfMonth);
      year = currentYear + 1;
    }
    const daysUntil = Math.floor((occurrence.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil > ev.leadTimeDays) continue; // non ancora in finestra

    upcoming.push({
      ...ev,
      occurrenceDateIso: occurrence.toISOString(),
      daysUntil,
      yearTag: String(year),
      alreadyDrafted: false, // riempito sotto
    });
  }

  if (upcoming.length === 0) return upcoming;

  // Check quali sono gia state "attivate" (esiste draft con tag corrispondente).
  // Tag format: [RICORRENZA:<eventId>:<year>]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const tags = upcoming.map((u) => `[RICORRENZA:${u.id}:${u.yearTag}]`);
  const { data: existing } = await admin
    .from("content_drafts")
    .select("theme_input")
    .eq("organization_id", organizationId)
    .in(
      "theme_input",
      // supabase.js non supporta wildcard IN — usiamo ilike per matching prefisso
      tags,
    );
  const existingTags = new Set(
    ((existing ?? []) as Array<{ theme_input: string }>).map((r) => r.theme_input),
  );

  return upcoming.map((u) => ({
    ...u,
    alreadyDrafted: existingTags.has(`[RICORRENZA:${u.id}:${u.yearTag}]`),
  }));
}

export async function listAllRecurrences(organizationId: string): Promise<RecurringEvent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_recurring_events")
    .select(
      "id, organization_id, brand_id, name, kind, month_of_year, day_of_month, lead_time_days, suggested_theme, is_active, created_at, brands!inner(slug, display_name, color, is_archived)",
    )
    .eq("organization_id", organizationId)
    .eq("brands.is_archived", false)
    .order("month_of_year")
    .order("day_of_month");
  if (error) throw new Error(`Errore lettura ricorrenze: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToEvent);
}

export async function insertRecurrence(input: {
  organizationId: string;
  brandId: string;
  name: string;
  kind: RecurringEventKind;
  monthOfYear: number;
  dayOfMonth: number;
  leadTimeDays: number;
  suggestedTheme: string;
}): Promise<RecurringEvent> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_recurring_events")
    .insert({
      organization_id: input.organizationId,
      brand_id: input.brandId,
      name: input.name,
      kind: input.kind,
      month_of_year: input.monthOfYear,
      day_of_month: input.dayOfMonth,
      lead_time_days: input.leadTimeDays,
      suggested_theme: input.suggestedTheme,
      is_active: true,
    })
    .select(
      "id, organization_id, brand_id, name, kind, month_of_year, day_of_month, lead_time_days, suggested_theme, is_active, created_at, brands!inner(slug, display_name, color, is_archived)",
    )
    .single();
  if (error) throw new Error(`Errore insert ricorrenza: ${error.message}`);
  return rowToEvent(data);
}

export async function updateRecurrenceRow(
  organizationId: string,
  id: string,
  patch: {
    name?: string;
    kind?: RecurringEventKind;
    monthOfYear?: number;
    dayOfMonth?: number;
    leadTimeDays?: number;
    suggestedTheme?: string;
    isActive?: boolean;
  },
): Promise<RecurringEvent | null> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch["name"] = patch.name;
  if (patch.kind !== undefined) dbPatch["kind"] = patch.kind;
  if (patch.monthOfYear !== undefined) dbPatch["month_of_year"] = patch.monthOfYear;
  if (patch.dayOfMonth !== undefined) dbPatch["day_of_month"] = patch.dayOfMonth;
  if (patch.leadTimeDays !== undefined) dbPatch["lead_time_days"] = patch.leadTimeDays;
  if (patch.suggestedTheme !== undefined) dbPatch["suggested_theme"] = patch.suggestedTheme;
  if (patch.isActive !== undefined) dbPatch["is_active"] = patch.isActive;
  dbPatch["updated_at"] = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_recurring_events")
    .update(dbPatch)
    .eq("organization_id", organizationId)
    .eq("id", id)
    .select(
      "id, organization_id, brand_id, name, kind, month_of_year, day_of_month, lead_time_days, suggested_theme, is_active, created_at, brands!inner(slug, display_name, color, is_archived)",
    )
    .maybeSingle();
  if (error) throw new Error(`Errore update ricorrenza: ${error.message}`);
  return data ? rowToEvent(data) : null;
}

export async function deleteRecurrenceRow(organizationId: string, id: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error, count } = await admin
    .from("brand_recurring_events")
    .delete({ count: "exact" })
    .eq("organization_id", organizationId)
    .eq("id", id);
  if (error) throw new Error(`Errore delete ricorrenza: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function getRecurrenceById(
  organizationId: string,
  eventId: string,
): Promise<RecurringEvent | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brand_recurring_events")
    .select(
      "id, organization_id, brand_id, name, kind, month_of_year, day_of_month, lead_time_days, suggested_theme, is_active, created_at, brands!inner(slug, display_name, color, is_archived)",
    )
    .eq("organization_id", organizationId)
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error(`Errore fetch ricorrenza: ${error.message}`);
  return data ? rowToEvent(data) : null;
}
