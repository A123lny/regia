// RF-1.9 Dossier dati personali: aggrega TUTTO quello che Regia possiede su un contatto.
// Non tocca i sistemi di origine (gestionali Lenny/Stazione): quei dati vanno
// richiesti separatamente al team interno (vincolo RF-1.1 sola lettura).

import { getAdminClient } from "@/lib/db/admin";

export type ContactDossier = {
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    source: string;
    tags: string[];
    createdAt: string;
    archivedAt: string | null;
    isDuplicateOf: string | null;
  };
  consents: Array<{
    channel: string;
    status: string;
    grantedAt: string | null;
    revokedAt: string | null;
    source: string | null;
    unsubscribeReason: string | null;
    reduceFrequency: boolean;
  }>;
  vehicles: Array<{
    plate: string;
    brand: string | null;
    model: string | null;
    lastServiceAt: string | null;
  }>;
  vouchers: Array<{
    code: string;
    status: string;
    issuedAt: string;
    redeemedAt: string | null;
    expiresAt: string;
    rewardKind: string;
  }>;
  orders: Array<{
    externalId: string;
    placedAt: string;
    totalCents: number;
    status: string;
  }>;
  signupEvents: Array<{
    landingSlug: string | null;
    audienceKind: string | null;
    channelsGranted: string[];
    createdAt: string;
  }>;
  reminders: Array<{
    kind: string;
    status: string;
    scheduledAt: string;
    sentAt: string | null;
  }>;
  publishLog: Array<{
    channel: string;
    status: string;
    sentAt: string;
    recipientAddress: string;
  }>;
  previousDataRequests: Array<{
    requestType: string;
    status: string;
    requestedAt: string;
    fulfilledAt: string | null;
  }>;
};

/**
 * Costruisce il dossier completo per un contatto. Letture read-only cross-modulo.
 * RS-1 note: la lettura cross-tabelle qui NON viola i confini modulo perche'
 * il contatto e' la radice del dossier (siamo in m01-data-hub, che e' il modulo
 * dei contatti). Le altre tabelle sono dati collegati per FK: non chiamiamo
 * public.ts di altri moduli, leggiamo direttamente in sola lettura come fa
 * la pagina detail /contatti/[id].
 */
export async function buildContactDossier(
  organizationId: string,
  contactId: string,
): Promise<ContactDossier | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  const { data: contact, error: cErr } = await admin
    .from("contacts")
    .select(
      "id, first_name, last_name, email, phone, whatsapp, source, tags, created_at, archived_at, is_duplicate_of",
    )
    .eq("organization_id", organizationId)
    .eq("id", contactId)
    .maybeSingle();
  if (cErr) throw new Error(`buildContactDossier contact: ${cErr.message}`);
  if (!contact) return null;

  const [consents, vehicles, vouchers, orders, signups, reminders, publishLog, dataReqs] =
    await Promise.all([
      admin
        .from("contact_consents")
        .select(
          "channel, status, granted_at, revoked_at, source, unsubscribe_reason, reduce_frequency",
        )
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .then((r: { data: unknown[] | null }) => r.data ?? []),
      admin
        .from("contact_vehicles")
        .select("plate, brand, model, last_service_at")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .then((r: { data: unknown[] | null }) => r.data ?? []),
      admin
        .from("vouchers")
        .select("code, status, issued_at, redeemed_at, expires_at, reward_kind")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .then((r: { data: unknown[] | null }) => r.data ?? []),
      admin
        .from("brand_orders")
        .select("external_id, placed_at, total_cents, status")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .then((r: { data: unknown[] | null }) => r.data ?? []),
      admin
        .from("signup_events")
        .select("audience_kind, channels_granted, created_at, signup_landings!inner(slug)")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .then((r: { data: unknown[] | null }) => r.data ?? []),
      admin
        .from("reminders")
        .select("kind, status, scheduled_at, sent_at")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .then((r: { data: unknown[] | null }) => r.data ?? []),
      admin
        .from("m05_publish_log")
        .select("channel, status, sent_at, recipient_address")
        .eq("organization_id", organizationId)
        .eq("recipient_contact_id", contactId)
        .then((r: { data: unknown[] | null }) => r.data ?? []),
      admin
        .from("contact_data_requests")
        .select("request_type, status, requested_at, fulfilled_at")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .then((r: { data: unknown[] | null }) => r.data ?? []),
    ]);

  return {
    contact: {
      id: contact.id,
      firstName: contact.first_name,
      lastName: contact.last_name,
      email: contact.email,
      phone: contact.phone,
      whatsapp: contact.whatsapp,
      source: contact.source,
      tags: (contact.tags ?? []) as string[],
      createdAt: contact.created_at,
      archivedAt: contact.archived_at,
      isDuplicateOf: contact.is_duplicate_of,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    consents: (consents as any[]).map((r) => ({
      channel: r.channel,
      status: r.status,
      grantedAt: r.granted_at ?? null,
      revokedAt: r.revoked_at ?? null,
      source: r.source ?? null,
      unsubscribeReason: r.unsubscribe_reason ?? null,
      reduceFrequency: r.reduce_frequency ?? false,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vehicles: (vehicles as any[]).map((r) => ({
      plate: r.plate,
      brand: r.brand ?? null,
      model: r.model ?? null,
      lastServiceAt: r.last_service_at ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vouchers: (vouchers as any[]).map((r) => ({
      code: r.code,
      status: r.status,
      issuedAt: r.issued_at,
      redeemedAt: r.redeemed_at ?? null,
      expiresAt: r.expires_at,
      rewardKind: r.reward_kind,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    orders: (orders as any[]).map((r) => ({
      externalId: r.external_id,
      placedAt: r.placed_at,
      totalCents: r.total_cents,
      status: r.status,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    signupEvents: (signups as any[]).map((r) => ({
      landingSlug: r.signup_landings?.slug ?? null,
      audienceKind: r.audience_kind ?? null,
      channelsGranted: (r.channels_granted ?? []) as string[],
      createdAt: r.created_at,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reminders: (reminders as any[]).map((r) => ({
      kind: r.kind,
      status: r.status,
      scheduledAt: r.scheduled_at,
      sentAt: r.sent_at ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    publishLog: (publishLog as any[]).map((r) => ({
      channel: r.channel,
      status: r.status,
      sentAt: r.sent_at,
      recipientAddress: r.recipient_address,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    previousDataRequests: (dataReqs as any[]).map((r) => ({
      requestType: r.request_type,
      status: r.status,
      requestedAt: r.requested_at,
      fulfilledAt: r.fulfilled_at ?? null,
    })),
  };
}

// ============================================================================
// contact_data_requests CRUD
// ============================================================================

export type DataRequestType = "export" | "erasure";
export type DataRequestStatus = "pending" | "fulfilled" | "rejected";

export type ContactDataRequest = {
  id: string;
  organizationId: string;
  contactId: string;
  requestType: DataRequestType;
  status: DataRequestStatus;
  requestedAt: string;
  requestedVia: string | null;
  fulfilledAt: string | null;
  decisionNotes: string | null;
};

export type ContactDataRequestRow = ContactDataRequest & {
  contactFullName: string | null;
  contactEmail: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRequest(row: any): ContactDataRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    contactId: row.contact_id,
    requestType: row.request_type as DataRequestType,
    status: row.status as DataRequestStatus,
    requestedAt: row.requested_at,
    requestedVia: row.requested_via ?? null,
    fulfilledAt: row.fulfilled_at ?? null,
    decisionNotes: row.decision_notes ?? null,
  };
}

export async function listDataRequests(
  organizationId: string,
  options?: { onlyPending?: boolean; contactId?: string },
): Promise<ContactDataRequestRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  // Security: filtro join su contacts.organization_id per difesa in profondita'.
  // RLS + eq principale sono gia' sufficienti ma la doppia guardia impedisce
  // leak se un contact dovesse mai avere organization_id disallineato (schema
  // bug ipotetico).
  let q = admin
    .from("contact_data_requests")
    .select("*, contacts!inner(first_name, last_name, email, organization_id)")
    .eq("organization_id", organizationId)
    .eq("contacts.organization_id", organizationId);
  if (options?.contactId) q = q.eq("contact_id", options.contactId);
  if (options?.onlyPending) q = q.eq("status", "pending");
  const { data, error } = await q.order("requested_at", { ascending: false });
  if (error) throw new Error(`listDataRequests: ${error.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map((r): ContactDataRequestRow => {
    const parts = [r.contacts?.first_name, r.contacts?.last_name].filter((v: unknown) =>
      Boolean(v),
    );
    return {
      ...rowToRequest(r),
      contactFullName: parts.length > 0 ? parts.join(" ") : null,
      contactEmail: (r.contacts?.email as string | null) ?? null,
    };
  });
}

export type CreateDataRequestInput = {
  organizationId: string;
  contactId: string;
  requestType: DataRequestType;
  requestedVia?: string;
  requestedBy: string | null;
};

export async function createDataRequest(
  input: CreateDataRequestInput,
): Promise<ContactDataRequest> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const row: Record<string, unknown> = {
    organization_id: input.organizationId,
    contact_id: input.contactId,
    request_type: input.requestType,
    requested_by: input.requestedBy,
  };
  if (input.requestedVia !== undefined) row["requested_via"] = input.requestedVia;
  const { data, error } = await admin
    .from("contact_data_requests")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(`createDataRequest: ${error.message}`);
  return rowToRequest(data);
}

export type FulfillDataRequestInput = {
  organizationId: string;
  requestId: string;
  decision: "fulfilled" | "rejected";
  fulfilledBy: string | null;
  notes?: string;
  dossierSnapshot?: ContactDossier;
};

/**
 * Chiude una richiesta dati con snapshot immutabile (audit) + per erasure
 * marca il contatto come archiviato (soft delete).
 *
 * Vincolo RF-1.9: cancellazione = archiviazione + nullificazione campi
 * identificativi (email/phone/whatsapp/first_name/last_name). I dati storici
 * (ordini, voucher gia' usati, publish log) RESTANO per audit — solo l'ancora
 * identificativa viene svuotata. Il contact.id resta per preservare FK.
 */
export async function fulfillDataRequest(
  input: FulfillDataRequestInput,
): Promise<ContactDataRequest> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const patch: Record<string, unknown> = {
    status: input.decision,
    fulfilled_at: new Date().toISOString(),
    fulfilled_by: input.fulfilledBy,
  };
  if (input.notes !== undefined) patch["decision_notes"] = input.notes;
  if (input.dossierSnapshot !== undefined) patch["dossier_snapshot"] = input.dossierSnapshot;

  const { data: updated, error } = await admin
    .from("contact_data_requests")
    .update(patch)
    .eq("id", input.requestId)
    .eq("organization_id", input.organizationId)
    .eq("status", "pending")
    .select("*")
    .single();
  if (error) throw new Error(`fulfillDataRequest: ${error.message}`);
  if (!updated) throw new Error("Richiesta non trovata o gia' chiusa");

  // Erasure fulfilled: nullifico identificativi + archivio contatto.
  if (input.decision === "fulfilled" && updated.request_type === "erasure") {
    const now = new Date().toISOString();
    const { error: eraseErr } = await admin
      .from("contacts")
      .update({
        first_name: null,
        last_name: null,
        email: null,
        phone: null,
        whatsapp: null,
        archived_at: now,
        updated_at: now,
      })
      .eq("id", updated.contact_id)
      .eq("organization_id", input.organizationId);
    if (eraseErr) throw new Error(`erasure anagrafica: ${eraseErr.message}`);
  }

  return rowToRequest(updated);
}
