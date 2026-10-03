import { describe, it, expect, beforeAll } from "vitest";
import { getAdminClient } from "@/lib/db/admin";
import {
  buildContactDossier,
  createDataRequest,
  fulfillDataRequest,
  listDataRequests,
} from "@/modules/m01-data-hub/internal/data-dossier-repo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = getAdminClient() as any;

describe("M01 Richieste dati personali (RF-1.9)", () => {
  let orgId: string;
  let brandId: string;
  let contactId: string;

  beforeAll(async () => {
    const org = await admin
      .from("organizations")
      .insert({ name: "Test GDPR" })
      .select("id")
      .single();
    if (org.error || !org.data) throw new Error(`org: ${org.error?.message}`);
    orgId = org.data.id;
    const brand = await admin
      .from("brands")
      .insert({ organization_id: orgId, slug: `g-${orgId.slice(0, 6)}`, display_name: "G" })
      .select("id")
      .single();
    if (brand.error || !brand.data) throw new Error(`brand: ${brand.error?.message}`);
    brandId = brand.data.id;
    const contact = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "Luigi",
        last_name: "Rossi",
        email: "luigi.rossi@test.it",
        phone: "+39333000111",
        source: "manuale",
      })
      .select("id")
      .single();
    if (contact.error || !contact.data) throw new Error(`contact: ${contact.error?.message}`);
    contactId = contact.data.id;
    // Aggiungo consent + voucher per rendere il dossier non-vuoto
    await admin.from("contact_consents").insert({
      organization_id: orgId,
      contact_id: contactId,
      channel: "email",
      status: "granted",
      granted_at: new Date().toISOString(),
      source: "manuale",
    });
  });

  it("buildContactDossier aggrega consensi + anagrafica cross-modulo", async () => {
    const d = await buildContactDossier(orgId, contactId);
    expect(d).not.toBeNull();
    expect(d?.contact.email).toBe("luigi.rossi@test.it");
    expect(d?.consents).toHaveLength(1);
    expect(d?.consents[0]?.channel).toBe("email");
  });

  it("buildContactDossier ritorna null per contatto non esistente", async () => {
    const fakeId = "00000000-0000-0000-0000-00000000bbbb";
    const d = await buildContactDossier(orgId, fakeId);
    expect(d).toBeNull();
  });

  it("createDataRequest crea con status=pending", async () => {
    const r = await createDataRequest({
      organizationId: orgId,
      contactId,
      requestType: "export",
      requestedBy: null,
    });
    expect(r.status).toBe("pending");
    expect(r.requestType).toBe("export");
  });

  it("fulfillDataRequest(export, fulfilled): status fulfilled + snapshot salvato", async () => {
    const req = await createDataRequest({
      organizationId: orgId,
      contactId,
      requestType: "export",
      requestedBy: null,
    });
    const dossier = await buildContactDossier(orgId, contactId);
    const result = await fulfillDataRequest({
      organizationId: orgId,
      requestId: req.id,
      decision: "fulfilled",
      fulfilledBy: null,
      notes: "Inviato via email",
      ...(dossier ? { dossierSnapshot: dossier } : {}),
    });
    expect(result.status).toBe("fulfilled");
    // Snapshot presente nel DB
    const { data } = await admin
      .from("contact_data_requests")
      .select("dossier_snapshot")
      .eq("id", req.id)
      .single();
    expect(data.dossier_snapshot).not.toBeNull();
    expect(data.dossier_snapshot.contact.email).toBe("luigi.rossi@test.it");
  });

  it("fulfillDataRequest(erasure, fulfilled): nullifica identificativi + archivia contatto", async () => {
    // Nuovo contatto da cancellare
    const c = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        brand_id: brandId,
        first_name: "DaCancellare",
        email: "cancella@test.it",
        source: "manuale",
      })
      .select("id")
      .single();
    const cid = c.data.id;
    const req = await createDataRequest({
      organizationId: orgId,
      contactId: cid,
      requestType: "erasure",
      requestedBy: null,
    });
    await fulfillDataRequest({
      organizationId: orgId,
      requestId: req.id,
      decision: "fulfilled",
      fulfilledBy: null,
    });
    const { data: after } = await admin
      .from("contacts")
      .select("first_name, email, phone, whatsapp, archived_at")
      .eq("id", cid)
      .single();
    expect(after.first_name).toBeNull();
    expect(after.email).toBeNull();
    expect(after.phone).toBeNull();
    expect(after.whatsapp).toBeNull();
    expect(after.archived_at).not.toBeNull();
  });

  it("fulfillDataRequest rifiuta richiesta gia' chiusa (idempotenza)", async () => {
    const req = await createDataRequest({
      organizationId: orgId,
      contactId,
      requestType: "export",
      requestedBy: null,
    });
    await fulfillDataRequest({
      organizationId: orgId,
      requestId: req.id,
      decision: "fulfilled",
      fulfilledBy: null,
    });
    // Secondo tentativo deve fallire (where status='pending' non matcha piu')
    await expect(
      fulfillDataRequest({
        organizationId: orgId,
        requestId: req.id,
        decision: "rejected",
        fulfilledBy: null,
      }),
    ).rejects.toThrow();
  });

  it("listDataRequests onlyPending esclude evasi/respinti", async () => {
    const all = await listDataRequests(orgId);
    const pending = await listDataRequests(orgId, { onlyPending: true });
    expect(all.length).toBeGreaterThan(pending.length);
    expect(pending.every((r) => r.status === "pending")).toBe(true);
  });
});
