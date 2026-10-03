// RF-6.18 + RN-41..43 Capacita rider (Lenny food).
// Finestre ricorrenti settimanali + richieste quantificate.
// La guard `assertRiderCapacityOk` e' il punto in cui il codice dispone (RA-8.6):
// una promo food che punta a una fascia satura DEVE essere rifiutata o posticipata.

import { getAdminClient } from "@/lib/db/admin";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mer",
  4: "Gio",
  5: "Ven",
  6: "Sab",
};

export type RiderCapacityWindow = {
  id: string;
  organizationId: string;
  brandId: string;
  weekday: Weekday;
  timeStart: string; // HH:MM:SS
  timeEnd: string;
  slotsTotal: number;
  slotsFilled: number;
  note: string | null;
  updatedAt: string;
};

export type RiderCapacityWindowRow = RiderCapacityWindow & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
  fillRatio: number; // 0..1 (slotsFilled / slotsTotal), 0 se slotsTotal=0
  isSaturated: boolean; // fillRatio >= 1 or slotsTotal=0
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToWindow(row: any): RiderCapacityWindow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    weekday: row.weekday as Weekday,
    timeStart: row.time_start,
    timeEnd: row.time_end,
    slotsTotal: row.slots_total,
    slotsFilled: row.slots_filled,
    note: row.note ?? null,
    updatedAt: row.updated_at,
  };
}

export async function listRiderCapacityWindows(
  organizationId: string,
  brandId?: string,
): Promise<RiderCapacityWindowRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("rider_capacity_windows")
    .select("*, brands!inner(slug, display_name, color)")
    .eq("organization_id", organizationId);
  if (brandId) q = q.eq("brand_id", brandId);
  const { data, error } = await q
    .order("brand_id", { ascending: true })
    .order("weekday", { ascending: true })
    .order("time_start", { ascending: true });
  if (error) throw new Error(`listRiderCapacityWindows: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r): RiderCapacityWindowRow => {
    const w = rowToWindow(r);
    const ratio = w.slotsTotal > 0 ? w.slotsFilled / w.slotsTotal : 0;
    return {
      ...w,
      brandSlug: r.brands.slug as string,
      brandDisplayName: r.brands.display_name as string,
      brandColor: r.brands.color as string,
      fillRatio: ratio,
      isSaturated: w.slotsTotal === 0 || ratio >= 1,
    };
  });
}

export type UpsertCapacityWindowInput = {
  organizationId: string;
  brandId: string;
  weekday: Weekday;
  timeStart: string; // "HH:MM"
  timeEnd: string;
  slotsTotal: number;
  slotsFilled?: number;
  note?: string | null;
};

export async function upsertRiderCapacityWindow(
  input: UpsertCapacityWindowInput,
): Promise<RiderCapacityWindow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    weekday: input.weekday,
    time_start: input.timeStart,
    time_end: input.timeEnd,
    slots_total: input.slotsTotal,
    updated_at: new Date().toISOString(),
  };
  if (input.slotsFilled !== undefined) row["slots_filled"] = input.slotsFilled;
  if (input.note !== undefined) row["note"] = input.note;
  const { data, error } = await admin
    .from("rider_capacity_windows")
    .upsert(row, { onConflict: "organization_id,brand_id,weekday,time_start" })
    .select("*")
    .single();
  if (error) throw new Error(`upsertRiderCapacityWindow: ${error.message}`);
  return rowToWindow(data);
}

export async function updateFilledSlots(
  organizationId: string,
  windowId: string,
  slotsFilled: number,
): Promise<void> {
  if (slotsFilled < 0) throw new Error("slots_filled non puo' essere negativo");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("rider_capacity_windows")
    .update({ slots_filled: slotsFilled, updated_at: new Date().toISOString() })
    .eq("id", windowId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(`updateFilledSlots: ${error.message}`);
}

export async function deleteRiderCapacityWindow(
  organizationId: string,
  windowId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("rider_capacity_windows")
    .delete()
    .eq("id", windowId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(`deleteRiderCapacityWindow: ${error.message}`);
}

// ============================================================================
// Shift requests (RN-43 richieste rider quantificate)
// ============================================================================

export type ShiftRequestStatus = "pending" | "partially_filled" | "filled" | "cancelled";

export type RiderShiftRequest = {
  id: string;
  organizationId: string;
  brandId: string;
  shiftDate: string; // ISO date
  timeStart: string;
  timeEnd: string;
  slotsNeeded: number;
  slotsFilled: number;
  note: string | null;
  status: ShiftRequestStatus;
  createdAt: string;
};

export type RiderShiftRequestRow = RiderShiftRequest & {
  brandSlug: string;
  brandDisplayName: string;
  brandColor: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToShift(row: any): RiderShiftRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    brandId: row.brand_id,
    shiftDate: row.shift_date,
    timeStart: row.time_start,
    timeEnd: row.time_end,
    slotsNeeded: row.slots_needed,
    slotsFilled: row.slots_filled,
    note: row.note ?? null,
    status: row.status as ShiftRequestStatus,
    createdAt: row.created_at,
  };
}

export async function listRiderShiftRequests(
  organizationId: string,
  options?: { onlyActive?: boolean; brandId?: string },
): Promise<RiderShiftRequestRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  let q = admin
    .from("rider_shift_requests")
    .select("*, brands!inner(slug, display_name, color)")
    .eq("organization_id", organizationId);
  if (options?.brandId) q = q.eq("brand_id", options.brandId);
  if (options?.onlyActive) q = q.in("status", ["pending", "partially_filled"]);
  const { data, error } = await q
    .order("shift_date", { ascending: true })
    .order("time_start", { ascending: true });
  if (error) throw new Error(`listRiderShiftRequests: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r): RiderShiftRequestRow => ({
    ...rowToShift(r),
    brandSlug: r.brands.slug as string,
    brandDisplayName: r.brands.display_name as string,
    brandColor: r.brands.color as string,
  }));
}

export type CreateShiftRequestInput = {
  organizationId: string;
  brandId: string;
  shiftDate: string; // "YYYY-MM-DD"
  timeStart: string;
  timeEnd: string;
  slotsNeeded: number;
  note?: string;
  createdBy: string | null;
};

export async function createRiderShiftRequest(
  input: CreateShiftRequestInput,
): Promise<RiderShiftRequest> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    brand_id: input.brandId,
    shift_date: input.shiftDate,
    time_start: input.timeStart,
    time_end: input.timeEnd,
    slots_needed: input.slotsNeeded,
    created_by: input.createdBy,
  };
  if (input.note !== undefined) row["note"] = input.note;
  const { data, error } = await admin.from("rider_shift_requests").insert(row).select("*").single();
  if (error) throw new Error(`createRiderShiftRequest: ${error.message}`);
  return rowToShift(data);
}

export async function updateShiftRequestFilled(
  organizationId: string,
  requestId: string,
  slotsFilled: number,
): Promise<RiderShiftRequest | null> {
  if (slotsFilled < 0) throw new Error("slots_filled non puo' essere negativo");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("rider_shift_requests")
    .update({ slots_filled: slotsFilled })
    .eq("id", requestId)
    .eq("organization_id", organizationId)
    .not("status", "eq", "cancelled")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`updateShiftRequestFilled: ${error.message}`);
  return data ? rowToShift(data) : null;
}

export async function cancelShiftRequest(
  organizationId: string,
  requestId: string,
): Promise<RiderShiftRequest | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("rider_shift_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("organization_id", organizationId)
    .not("status", "eq", "cancelled")
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`cancelShiftRequest: ${error.message}`);
  return data ? rowToShift(data) : null;
}

// ============================================================================
// GUARD (RF-6.18): checkRiderCapacityForSlot
// ============================================================================

export class RiderCapacityExceededError extends Error {
  constructor(
    public details: {
      brandId: string;
      weekday: Weekday;
      time: string;
      slotsTotal: number;
      slotsFilled: number;
    },
  ) {
    super(
      `Capacita rider satura: brand=${details.brandId}, giorno=${WEEKDAY_LABELS[details.weekday]}, ora=${details.time} (${details.slotsFilled}/${details.slotsTotal} slot). RF-6.18: nessuna promo deve generare domanda oltre la capacita.`,
    );
    this.name = "RiderCapacityExceededError";
  }
}

/**
 * RF-6.18 guard: controlla se la fascia (brand, weekday, orario) ha capacita
 * residua >= soglia. Default soglia 10%: se slots_filled >= 90% di slots_total,
 * la finestra e' considerata satura e nessuna nuova promo food dovrebbe
 * generare altra domanda in quella fascia.
 *
 * ritorna { ok: true } o { ok: false, reason, details }.
 * I chiamanti decidono se sollevare throw (motore promo) o mostrare warning (UI).
 */
export type CapacityCheckResult =
  | { ok: true; slotsTotal: number; slotsFilled: number; fillRatio: number }
  | {
      ok: false;
      reason: "no_window_configured" | "saturated" | "zero_capacity";
      slotsTotal: number;
      slotsFilled: number;
      fillRatio: number;
    };

export async function checkRiderCapacityForSlot(
  organizationId: string,
  brandId: string,
  weekday: Weekday,
  timeIso: string, // "HH:MM" o "HH:MM:SS"
  minResidualRatio = 0.1,
): Promise<CapacityCheckResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const normalizedTime = timeIso.length === 5 ? `${timeIso}:00` : timeIso;
  // Finestre che contengono il timestamp (time_start <= t < time_end)
  const { data, error } = await admin
    .from("rider_capacity_windows")
    .select("slots_total, slots_filled")
    .eq("organization_id", organizationId)
    .eq("brand_id", brandId)
    .eq("weekday", weekday)
    .lte("time_start", normalizedTime)
    .gt("time_end", normalizedTime)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`checkRiderCapacityForSlot: ${error.message}`);

  if (!data) {
    // Nessuna finestra configurata per quella fascia: default conservativo = NON promuovere
    // (il titolare non ha dichiarato capacita, non sappiamo quanti rider servono).
    return {
      ok: false,
      reason: "no_window_configured",
      slotsTotal: 0,
      slotsFilled: 0,
      fillRatio: 0,
    };
  }

  const slotsTotal = Number(data.slots_total ?? 0);
  const slotsFilled = Number(data.slots_filled ?? 0);
  if (slotsTotal === 0) {
    return {
      ok: false,
      reason: "zero_capacity",
      slotsTotal,
      slotsFilled,
      fillRatio: 0,
    };
  }
  const ratio = slotsFilled / slotsTotal;
  if (1 - ratio < minResidualRatio) {
    return {
      ok: false,
      reason: "saturated",
      slotsTotal,
      slotsFilled,
      fillRatio: ratio,
    };
  }
  return { ok: true, slotsTotal, slotsFilled, fillRatio: ratio };
}

/**
 * Variante throw: utile come guard "codice dispone" nel motore promo food.
 */
export async function assertRiderCapacityOk(
  organizationId: string,
  brandId: string,
  weekday: Weekday,
  timeIso: string,
  minResidualRatio?: number,
): Promise<void> {
  const check = await checkRiderCapacityForSlot(
    organizationId,
    brandId,
    weekday,
    timeIso,
    minResidualRatio,
  );
  if (!check.ok) {
    throw new RiderCapacityExceededError({
      brandId,
      weekday,
      time: timeIso,
      slotsTotal: check.slotsTotal,
      slotsFilled: check.slotsFilled,
    });
  }
}
