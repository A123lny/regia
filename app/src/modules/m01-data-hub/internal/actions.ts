"use server";

// M01 Data Hub — server actions per contatti, consensi, veicoli.
// Ogni action: requireOwnedContact/requireOwnedBrand → validazione → repo →
// logAuditEvent (RF-11.3) → revalidatePath.

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability, type Capability } from "@/lib/auth/permissions";
import { logAuditEvent } from "@/lib/audit/log";
import {
  createContact,
  updateContact,
  archiveContact,
  restoreContact,
  getContact,
} from "./contacts-repo";
import { upsertConsent } from "./consents-repo";
import { createVehicle, updateVehicle, deleteVehicle } from "./vehicles-repo";
import { mergeContacts, type MergeResult } from "./merge-repo";
import { upsertSupplyPartner } from "./supply-partners-repo";
import type {
  ContactSource,
  ConsentChannel,
  ConsentSource,
  ConsentStatus,
  VehicleTireType,
} from "./contacts-types";

async function requireAuth(cap: Capability) {
  const session = await getSessionOrRedirect();
  requireCapability(session, cap);
  return session;
}

async function requireOwnedContact(contactId: string, cap: Capability) {
  const session = await requireAuth(cap);
  const contact = await getContact(contactId, session.organizationId);
  if (!contact) throw new Error("Contatto non trovato o accesso negato");
  return { session, contact };
}

async function requireOwnedBrand(brandId: string, organizationId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .select("id, slug, organization_id, is_archived")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw new Error(`Errore verifica brand: ${error.message}`);
  if (!data) throw new Error("Marchio non trovato");
  if (data.organization_id !== organizationId) {
    throw new Error("Accesso negato al marchio");
  }
  if (data.is_archived) throw new Error("Marchio archiviato: impossibile aggiungere contatti");
  return data as { id: string; slug: string; organization_id: string; is_archived: boolean };
}

// ============================================================================
// Contact CRUD
// ============================================================================

export type CreateContactActionInput = {
  brandId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  addressStreet?: string;
  addressCity?: string;
  addressCap?: string;
  notes?: string;
  source: ContactSource;
};

export async function createContactAction(
  input: CreateContactActionInput,
): Promise<{ ok: true; contactId: string } | { ok: false; error: string }> {
  const session = await requireAuth("contacts.crud");
  await requireOwnedBrand(input.brandId, session.organizationId);

  // Almeno un recapito (guardia applicativa in aggiunta al check DB)
  const hasAny =
    (input.email && input.email.trim()) ||
    (input.phone && input.phone.trim()) ||
    (input.whatsapp && input.whatsapp.trim());
  if (!hasAny) {
    return { ok: false, error: "Serve almeno un recapito (email, telefono o WhatsApp)" };
  }

  try {
    const contact = await createContact({
      organizationId: session.organizationId,
      brandId: input.brandId,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      whatsapp: input.whatsapp ?? null,
      addressStreet: input.addressStreet ?? null,
      addressCity: input.addressCity ?? null,
      addressCap: input.addressCap ?? null,
      notes: input.notes ?? null,
      source: input.source,
    });

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "contacts.contact_created",
      target: `brand:${input.brandId}`,
      details: { contactId: contact.id, source: contact.source },
    });

    revalidatePath("/contatti");
    return { ok: true, contactId: contact.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type UpdateContactActionInput = {
  contactId: string;
  patch: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    addressStreet?: string | null;
    addressCity?: string | null;
    addressCap?: string | null;
    notes?: string | null;
  };
};

export async function updateContactAction(
  input: UpdateContactActionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session } = await requireOwnedContact(input.contactId, "contacts.crud");
  try {
    await updateContact({
      contactId: input.contactId,
      organizationId: session.organizationId,
      patch: input.patch,
    });

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "contacts.contact_updated",
      target: `contact:${input.contactId}`,
      details: { fields: Object.keys(input.patch) },
    });

    revalidatePath("/contatti");
    revalidatePath(`/contatti/${input.contactId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function archiveContactAction(contactId: string): Promise<void> {
  const { session } = await requireOwnedContact(contactId, "contacts.crud");
  const ok = await archiveContact(contactId, session.organizationId);
  if (!ok) throw new Error("Contatto già archiviato o non trovato");
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "contacts.contact_archived",
    target: `contact:${contactId}`,
    details: {},
  });
  revalidatePath("/contatti");
}

export async function restoreContactAction(contactId: string): Promise<void> {
  const { session } = await requireOwnedContact(contactId, "contacts.crud");
  const ok = await restoreContact(contactId, session.organizationId);
  if (!ok) throw new Error("Contatto non archiviato o non trovato");
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "contacts.contact_restored",
    target: `contact:${contactId}`,
    details: {},
  });
  revalidatePath("/contatti");
}

// ============================================================================
// Consensi (RF-1.4)
// ============================================================================

export type UpsertConsentActionInput = {
  contactId: string;
  channel: ConsentChannel;
  status: ConsentStatus;
  source: ConsentSource;
  evidenceText?: string;
};

export async function upsertConsentAction(
  input: UpsertConsentActionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session } = await requireOwnedContact(input.contactId, "contacts.consent.manage");
  try {
    const consent = await upsertConsent({
      organizationId: session.organizationId,
      contactId: input.contactId,
      channel: input.channel,
      status: input.status,
      source: input.source,
      evidenceText: input.evidenceText ?? null,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "contacts.consent_updated",
      target: `contact:${input.contactId}`,
      details: {
        channel: input.channel,
        newStatus: input.status,
        source: input.source,
        consentId: consent.id,
      },
    });
    revalidatePath(`/contatti/${input.contactId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// Veicoli (RF-1.3)
// ============================================================================

export type CreateVehicleActionInput = {
  contactId: string;
  plate: string;
  model?: string;
  year?: number;
  kilometers?: number;
  lastServiceAt?: string;
  tireType?: VehicleTireType;
  notes?: string;
};

export async function createVehicleAction(
  input: CreateVehicleActionInput,
): Promise<{ ok: true; vehicleId: string } | { ok: false; error: string }> {
  const { session } = await requireOwnedContact(input.contactId, "contacts.crud");
  if (!input.plate || input.plate.trim().length < 5) {
    return { ok: false, error: "Targa non valida (minimo 5 caratteri)" };
  }
  try {
    const vehicle = await createVehicle({
      organizationId: session.organizationId,
      contactId: input.contactId,
      plate: input.plate,
      model: input.model ?? null,
      year: input.year ?? null,
      kilometers: input.kilometers ?? null,
      lastServiceAt: input.lastServiceAt ?? null,
      tireType: input.tireType ?? null,
      notes: input.notes ?? null,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "contacts.vehicle_created",
      target: `contact:${input.contactId}`,
      details: { vehicleId: vehicle.id, plate: vehicle.plate },
    });
    revalidatePath(`/contatti/${input.contactId}`);
    return { ok: true, vehicleId: vehicle.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type UpdateVehicleActionInput = {
  vehicleId: string;
  contactId: string; // per revalidate + audit target
  patch: Partial<Omit<CreateVehicleActionInput, "contactId">>;
};

export async function updateVehicleAction(
  input: UpdateVehicleActionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { session } = await requireOwnedContact(input.contactId, "contacts.crud");
  try {
    await updateVehicle({
      vehicleId: input.vehicleId,
      organizationId: session.organizationId,
      patch: input.patch,
    });
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "contacts.vehicle_updated",
      target: `contact:${input.contactId}`,
      details: { vehicleId: input.vehicleId, fields: Object.keys(input.patch) },
    });
    revalidatePath(`/contatti/${input.contactId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteVehicleAction(vehicleId: string, contactId: string): Promise<void> {
  const { session } = await requireOwnedContact(contactId, "contacts.crud");
  const ok = await deleteVehicle(vehicleId, session.organizationId);
  if (!ok) throw new Error("Veicolo non trovato");
  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "contacts.vehicle_deleted",
    target: `contact:${contactId}`,
    details: { vehicleId },
  });
  revalidatePath(`/contatti/${contactId}`);
}

// ============================================================================
// RF-1.7 Dedup merge (distruttivo, Owner-only)
// ============================================================================

export async function mergeContactsAction(input: {
  survivorId: string;
  duplicateId: string;
}): Promise<{ ok: true; result: MergeResult } | { ok: false; error: string }> {
  const session = await requireAuth("contacts.dedup.merge");
  try {
    const result = await mergeContacts(input.survivorId, input.duplicateId, session.organizationId);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "contacts.merged",
      target: `contact:${input.survivorId}`,
      details: {
        survivorId: input.survivorId,
        duplicateId: input.duplicateId,
        migratedOrders: result.migratedOrders,
        migratedVouchers: result.migratedVouchers,
        migratedVehicles: result.migratedVehicles,
        migratedCounterEvents: result.migratedCounterEvents,
        migratedSignupEvents: result.migratedSignupEvents,
        migratedReminders: result.migratedReminders,
        consentsUpdated: result.consentsUpdated,
      },
    });
    revalidatePath("/contatti");
    revalidatePath("/contatti/duplicati");
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// M6a Supply partners (RF-6.19)
// ============================================================================

export type UpsertSupplyPartnerActionInput = {
  partnerId?: string;
  name: string;
  referentName?: string;
  phone?: string;
  email?: string;
  category?: string;
  generalConsent: boolean;
  generalConsentNote?: string;
  notes?: string;
};

export async function upsertSupplyPartnerAction(
  input: UpsertSupplyPartnerActionInput,
): Promise<{ ok: true; partnerId: string } | { ok: false; error: string }> {
  const session = await requireAuth("supply.crud");
  if (
    input.generalConsent &&
    (!input.generalConsentNote || input.generalConsentNote.trim().length === 0)
  ) {
    return {
      ok: false,
      error: "Con assenso generale attivo serve indicare il motivo/scadenza dell'accordo",
    };
  }
  try {
    const payload: Parameters<typeof upsertSupplyPartner>[0] = {
      organizationId: session.organizationId,
      name: input.name,
      generalConsent: input.generalConsent,
    };
    if (input.partnerId) payload.partnerId = input.partnerId;
    if (input.referentName !== undefined) payload.referentName = input.referentName;
    if (input.phone !== undefined) payload.phone = input.phone;
    if (input.email !== undefined) payload.email = input.email;
    if (input.category !== undefined) payload.category = input.category;
    if (input.generalConsentNote !== undefined)
      payload.generalConsentNote = input.generalConsentNote;
    if (input.notes !== undefined) payload.notes = input.notes;

    const partner = await upsertSupplyPartner(payload);

    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: input.partnerId ? "supply.partner_updated" : "supply.partner_created",
      target: `supply:${partner.id}`,
      details: {
        name: partner.name,
        generalConsent: partner.generalConsent,
      },
    });

    revalidatePath("/fornitori");
    return { ok: true, partnerId: partner.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================================
// RF-1.9 Richieste dati personali (export/cancellazione)
// ============================================================================

import {
  buildContactDossier,
  listDataRequests,
  createDataRequest,
  fulfillDataRequest,
  type DataRequestType,
} from "./data-dossier-repo";

export async function getContactDossierAction(contactId: string) {
  const session = await getSessionOrRedirect();
  requireCapability(session, "contacts.data_request.read");
  return buildContactDossier(session.organizationId, contactId);
}

export async function listDataRequestsAction(options?: { onlyPending?: boolean }) {
  const session = await getSessionOrRedirect();
  requireCapability(session, "contacts.data_request.read");
  return listDataRequests(session.organizationId, options);
}

export async function createContactDataRequestAction(input: {
  contactId: string;
  requestType: DataRequestType;
  requestedVia?: string;
}): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  // Security: requireOwnedContact verifica che input.contactId appartenga a
  // session.organizationId (contro IDOR cross-tenant). Senza, un Owner org A
  // potrebbe aprire una data request su un contatto di org B.
  const { session } = await requireOwnedContact(input.contactId, "contacts.data_request.fulfill");
  try {
    const payload: Parameters<typeof createDataRequest>[0] = {
      organizationId: session.organizationId,
      contactId: input.contactId,
      requestType: input.requestType,
      requestedBy: session.userId,
    };
    if (input.requestedVia !== undefined) payload.requestedVia = input.requestedVia;
    const req = await createDataRequest(payload);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "contacts.data_request_created",
      target: `contact:${input.contactId}`,
      details: { requestType: input.requestType, requestedVia: input.requestedVia },
    });
    revalidatePath("/contatti");
    return { ok: true, requestId: req.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function fulfillContactDataRequestAction(input: {
  requestId: string;
  decision: "fulfilled" | "rejected";
  notes?: string;
  includeSnapshot?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSessionOrRedirect();
  requireCapability(session, "contacts.data_request.fulfill");
  try {
    // Security: carica la richiesta DAL DB filtrando per organization, usa il
    // contact_id STORED (non input lato client) per lo snapshot. Senza, un
    // Owner org A potrebbe passare requestId di org A + contactId di org B
    // nel body dell'action e far costruire snapshot cross-tenant.
    const requests = await listDataRequests(session.organizationId);
    const req = requests.find((r) => r.id === input.requestId);
    if (!req)
      return {
        ok: false,
        error: "Richiesta non trovata (o non appartiene alla tua organizzazione)",
      };
    if (req.status !== "pending") {
      return { ok: false, error: `Richiesta gia' ${req.status}` };
    }
    const payload: Parameters<typeof fulfillDataRequest>[0] = {
      organizationId: session.organizationId,
      requestId: input.requestId,
      decision: input.decision,
      fulfilledBy: session.userId,
    };
    if (input.notes !== undefined) payload.notes = input.notes;
    if (input.includeSnapshot && input.decision === "fulfilled") {
      // Usa req.contactId (DB-stored, autentico) NON un contactId client-supplied.
      const dossier = await buildContactDossier(session.organizationId, req.contactId);
      if (dossier) payload.dossierSnapshot = dossier;
    }
    const result = await fulfillDataRequest(payload);
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: `contacts.data_request_${input.decision}`,
      target: `request:${input.requestId}`,
      details: {
        contactId: req.contactId,
        requestType: result.requestType,
        notes: input.notes,
      },
    });
    revalidatePath("/contatti");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
