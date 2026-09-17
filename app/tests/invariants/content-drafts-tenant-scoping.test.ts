// RS-3 RN-87: getContentDraft filtra su organization_id — IDOR cross-tenant impossibile.
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { getContentDraft } from "@/modules/m03-editorial/public";

const SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const SERVICE_ROLE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

describe("getContentDraft: tenant scoping IDOR (RS-3, RN-87)", () => {
  let draftIdOrgA: string;
  let orgAId: string;
  let orgBId: string;

  beforeAll(async () => {
    // Crea due org temporanee isolate per questo test.
    const orgA = await admin
      .from("organizations")
      .insert({ name: "Test Org A — tenant-scoping" })
      .select("id")
      .single();
    if (orgA.error || !orgA.data) throw new Error(`Setup org-A fallito: ${orgA.error?.message}`);
    orgAId = (orgA.data as { id: string }).id;

    const orgB = await admin
      .from("organizations")
      .insert({ name: "Test Org B — tenant-scoping" })
      .select("id")
      .single();
    if (orgB.error || !orgB.data) throw new Error(`Setup org-B fallito: ${orgB.error?.message}`);
    orgBId = (orgB.data as { id: string }).id;

    // Crea un brand per org-A.
    const brandA = await admin
      .from("brands")
      .insert({
        organization_id: orgAId,
        slug: `brand-a-${orgAId.slice(0, 8)}`,
        display_name: "Brand A",
      })
      .select("id")
      .single();
    if (brandA.error || !brandA.data)
      throw new Error(`Setup brand-A fallito: ${brandA.error?.message}`);
    const brandIdOrgA = (brandA.data as { id: string }).id;

    // Inserisci un draft che appartiene a org-A.
    const draft = await admin
      .from("content_drafts")
      .insert({
        organization_id: orgAId,
        brand_id: brandIdOrgA,
        channel: "social",
        theme_input: "test idor org-a",
        generated_text: "testo org-a",
        prompt_version: "v1",
        model_used: "m",
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: 0,
        created_by: null,
      })
      .select("id")
      .single();
    if (draft.error || !draft.data)
      throw new Error(`Setup draft org-A fallito: ${draft.error?.message}`);
    draftIdOrgA = (draft.data as { id: string }).id;
  });

  it("getContentDraft(draftIdOrgA, orgBId) → null (IDOR bloccato)", async () => {
    // Un utente di Org-B NON deve vedere il draft di Org-A.
    const result = await getContentDraft(draftIdOrgA, orgBId);
    expect(result).toBeNull();
  });

  it("getContentDraft(draftIdOrgA, orgAId) → draft corretto (accesso legittimo)", async () => {
    // L'owner di Org-A deve poter leggere il proprio draft.
    const result = await getContentDraft(draftIdOrgA, orgAId);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(draftIdOrgA);
    expect(result?.organizationId).toBe(orgAId);
    expect(result?.themeInput).toBe("test idor org-a");
  });
});
