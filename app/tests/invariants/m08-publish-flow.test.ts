// RF-8.5 Macchina stati: pending → draft_ready → approved → published_externally.
// Scorciatoie vietate dalle server actions (approveReview richiede status=draft_ready;
// markReviewPublished richiede status=approved).

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { approveReview, markReviewPublished } from "@/modules/m08-reviews/internal/reviews-repo";

const url = process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "http://127.0.0.1:54520";
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin: any = createClient(url, serviceKey);
const ORG_ID = "00000000-0000-0000-0000-000000000001";

async function createReview(status: string, extra: Record<string, unknown> = {}): Promise<string> {
  const { data: brand } = await admin
    .from("brands")
    .select("id")
    .eq("organization_id", ORG_ID)
    .eq("slug", "lenny")
    .maybeSingle();
  const brandId = (brand as { id: string }).id;
  const { data } = await admin
    .from("reviews")
    .insert({
      organization_id: ORG_ID,
      brand_id: brandId,
      source: "google",
      external_id: `test-flow-${Date.now()}-${Math.random()}`,
      author_name: "Mario",
      rating: 4,
      text_original: "Bene",
      posted_at: new Date().toISOString(),
      classification: "positive",
      status,
      ...extra,
    })
    .select("id")
    .single();
  return (data as { id: string }).id;
}

describe("RF-8.5 · M08 publish flow", () => {
  const createdIds: string[] = [];
  let userId: string;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    if (data?.users[0]) {
      userId = data.users[0]!.id;
      return;
    }
    // CI parte da DB vergine (supabase db reset): nessun auth user. Creane uno.
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: `test-m08-${Date.now()}@test.local`,
      email_confirm: true,
      password: "test-password-m08-ci",
    });
    if (cErr || !created?.user) throw new Error(`createUser: ${cErr?.message}`);
    userId = created.user.id;
  });

  afterAll(async () => {
    for (const id of createdIds) await admin.from("reviews").delete().eq("id", id);
  });

  it("flow completo: draft_ready → approved → published_externally", async () => {
    const id = await createReview("draft_ready", { suggested_reply: "Grazie!" });
    createdIds.push(id);
    await approveReview(ORG_ID, id, "Grazie mille!", userId);
    const { data: a } = await admin
      .from("reviews")
      .select("status, approved_reply")
      .eq("id", id)
      .maybeSingle();
    expect((a as { status: string }).status).toBe("approved");
    expect((a as { approved_reply: string }).approved_reply).toBe("Grazie mille!");

    await markReviewPublished(ORG_ID, id);
    const { data: p } = await admin
      .from("reviews")
      .select("status, published_externally_at")
      .eq("id", id)
      .maybeSingle();
    expect((p as { status: string }).status).toBe("published_externally");
    expect(
      (p as { published_externally_at: string | null }).published_externally_at,
    ).not.toBeNull();
  });

  it("approve su status != draft_ready → nessun update (silent no-op)", async () => {
    const id = await createReview("pending");
    createdIds.push(id);
    await approveReview(ORG_ID, id, "Grazie", userId);
    const { data } = await admin.from("reviews").select("status").eq("id", id).maybeSingle();
    expect((data as { status: string }).status).toBe("pending");
  });

  it("markPublished su status != approved → nessun update", async () => {
    const id = await createReview("draft_ready", { suggested_reply: "x" });
    createdIds.push(id);
    await markReviewPublished(ORG_ID, id);
    const { data } = await admin.from("reviews").select("status").eq("id", id).maybeSingle();
    expect((data as { status: string }).status).toBe("draft_ready");
  });
});
