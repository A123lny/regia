// M01 Data Hub — repo veicoli (RF-1.3).
// Tenant-scoped su organization_id. Plate UNIQUE per (org, plate) garantita in DB.

import { getAdminClient } from "@/lib/db/admin";
import type { ContactVehicle, VehicleTireType } from "./contacts-types";

const SELECT_COLS =
  "id, organization_id, contact_id, plate, model, year, kilometers, last_service_at, tire_type, notes, created_at, updated_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToVehicle(row: any): ContactVehicle {
  return {
    id: row.id,
    organizationId: row.organization_id,
    contactId: row.contact_id,
    plate: row.plate,
    model: row.model ?? null,
    year: row.year ?? null,
    kilometers: row.kilometers ?? null,
    lastServiceAt: row.last_service_at ?? null,
    tireType: (row.tire_type as VehicleTireType | null) ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listVehiclesByContact(
  contactId: string,
  organizationId: string,
): Promise<ContactVehicle[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("contact_vehicles")
    .select(SELECT_COLS)
    .eq("contact_id", contactId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Errore lettura veicoli: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(rowToVehicle);
}

export type CreateVehicleInput = {
  organizationId: string;
  contactId: string;
  plate: string;
  model?: string | null;
  year?: number | null;
  kilometers?: number | null;
  lastServiceAt?: string | null;
  tireType?: VehicleTireType | null;
  notes?: string | null;
};

export async function createVehicle(input: CreateVehicleInput): Promise<ContactVehicle> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const insertRow: Record<string, unknown> = {
    organization_id: input.organizationId,
    contact_id: input.contactId,
    plate: input.plate.trim().toUpperCase(),
    model: input.model ?? null,
    year: input.year ?? null,
    kilometers: input.kilometers ?? null,
    last_service_at: input.lastServiceAt ?? null,
    tire_type: input.tireType ?? null,
    notes: input.notes ?? null,
  };
  const { data, error } = await admin
    .from("contact_vehicles")
    .insert(insertRow)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`Errore creazione veicolo: ${error.message}`);
  return rowToVehicle(data);
}

export type UpdateVehicleInput = {
  vehicleId: string;
  organizationId: string;
  patch: Partial<Omit<CreateVehicleInput, "organizationId" | "contactId">>;
};

export async function updateVehicle(input: UpdateVehicleInput): Promise<ContactVehicle | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = {};
  if (input.patch.plate !== undefined) patch["plate"] = input.patch.plate.trim().toUpperCase();
  if (input.patch.model !== undefined) patch["model"] = input.patch.model;
  if (input.patch.year !== undefined) patch["year"] = input.patch.year;
  if (input.patch.kilometers !== undefined) patch["kilometers"] = input.patch.kilometers;
  if (input.patch.lastServiceAt !== undefined) patch["last_service_at"] = input.patch.lastServiceAt;
  if (input.patch.tireType !== undefined) patch["tire_type"] = input.patch.tireType;
  if (input.patch.notes !== undefined) patch["notes"] = input.patch.notes;

  if (Object.keys(patch).length === 0) return null;

  const { data, error } = await admin
    .from("contact_vehicles")
    .update(patch)
    .eq("id", input.vehicleId)
    .eq("organization_id", input.organizationId)
    .select(SELECT_COLS)
    .maybeSingle();
  if (error) throw new Error(`Errore aggiornamento veicolo: ${error.message}`);
  return data ? rowToVehicle(data) : null;
}

export async function deleteVehicle(vehicleId: string, organizationId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error, count } = await admin
    .from("contact_vehicles")
    .delete({ count: "exact" })
    .eq("id", vehicleId)
    .eq("organization_id", organizationId);
  if (error) throw new Error(`Errore eliminazione veicolo: ${error.message}`);
  return (count ?? 0) > 0;
}
