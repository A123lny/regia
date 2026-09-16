"use server";

// M02 Brand — server actions per editing brand kit (RF-2.3, RF-2.3a, RF-2.4, RF-2.5).
// Ogni action:
//   1. verifica session Owner (RU-1a role check duplicato dal layout per safety)
//   2. verifica che brandId appartenga all'organization della session (RN-87 — IDOR fix)
//   3. valida input lato server
//   4. usa getAdminClient() (RS-2) — bypassa RLS by design
//   5. logga in audit_events (RF-11.3)
//   6. revalidatePath della pagina marchio per aggiornare UI

import { getAdminClient } from "@/lib/db/admin";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/log";
import { revalidatePath } from "next/cache";
import type { SensitiveTopicKind } from "./brand-kit-types";

async function requireOwner() {
  const session = await getSessionOrRedirect();
  if (session.role !== "owner") {
    throw new Error("Solo Owner può editare il brand kit (RU-1a)");
  }
  return session;
}

/**
 * Verifica che il brandId appartenga all'organization della session (RN-87).
 * Ritorna session + dati brand dal DB per uso downstream (slug, organization_id).
 * Il client non può mentire sullo slug: viene derivato dal DB dopo verifica.
 */
async function requireOwnedBrand(brandId: string) {
  const session = await requireOwner();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data, error } = await admin
    .from("brands")
    .select("id, slug, organization_id")
    .eq("id", brandId)
    .maybeSingle();
  if (error) throw new Error(`Errore verifica brand: ${error.message}`);
  if (!data) throw new Error("Brand non trovato");
  if (data.organization_id !== session.organizationId) {
    throw new Error("Accesso negato al brand");
  }
  return {
    session,
    brand: data as { id: string; slug: string; organization_id: string },
  };
}

function revalidateBrandPage(slug: string) {
  revalidatePath(`/marchi/${slug}`, "page");
}

// ─── TONO DI VOCE (RF-2.3) ─────────────────────────────────────────────────────

export async function updateBrandKitTone(brandId: string, toneOfVoice: string): Promise<void> {
  const { session, brand } = await requireOwnedBrand(brandId);
  if (toneOfVoice.length > 5000) {
    throw new Error("Tono di voce troppo lungo (max 5000 caratteri)");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("brand_kits")
    .update({ tone_of_voice: toneOfVoice, updated_at: new Date().toISOString() })
    .eq("brand_id", brandId);
  if (error) throw new Error(`Errore salvataggio tono: ${error.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand_kit.tone_updated",
    target: `brand:${brand.slug}`,
    details: { length: toneOfVoice.length },
  });
  revalidateBrandPage(brand.slug);
}

// ─── CONTESTO STRATEGICO (RF-2.3a) ─────────────────────────────────────────────

export async function updateBrandKitContext(
  brandId: string,
  payload: { purpose: string; yearGoal: string; direction: string },
): Promise<void> {
  const { session, brand } = await requireOwnedBrand(brandId);
  if (payload.purpose.length > 3000) throw new Error("Scopo/pubblico troppo lungo (max 3000)");
  if (payload.yearGoal.length > 3000) throw new Error("Obiettivo anno troppo lungo (max 3000)");
  if (payload.direction.length > 3000) throw new Error("Direzione futura troppo lunga (max 3000)");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("brand_kits")
    .update({
      strategic_purpose: payload.purpose,
      strategic_year_goal: payload.yearGoal,
      strategic_direction: payload.direction,
      updated_at: new Date().toISOString(),
    })
    .eq("brand_id", brandId);
  if (error) throw new Error(`Errore salvataggio contesto: ${error.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand_kit.context_updated",
    target: `brand:${brand.slug}`,
  });
  revalidateBrandPage(brand.slug);
}

// ─── RUBRICHE / PILLARS (RF-2.4) ───────────────────────────────────────────────

export async function addBrandPillar(
  brandId: string,
  payload: { name: string; weight: number },
): Promise<void> {
  const { session, brand } = await requireOwnedBrand(brandId);
  if (payload.name.length < 1 || payload.name.length > 100) {
    throw new Error("Nome rubrica non valido (1-100 caratteri)");
  }
  if (payload.weight < 1 || payload.weight > 10) {
    throw new Error("Peso rubrica fuori range (1-10)");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { data: maxRow } = await admin
    .from("brand_pillars")
    .select("sort_order")
    .eq("brand_id", brandId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = ((maxRow?.sort_order as number | undefined) ?? -1) + 1;

  const { error } = await admin.from("brand_pillars").insert({
    brand_id: brandId,
    name: payload.name,
    weight: payload.weight,
    sort_order: nextSort,
  });
  if (error) throw new Error(`Errore aggiunta rubrica: ${error.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand_kit.pillar_added",
    target: `brand:${brand.slug}`,
    details: { name: payload.name, weight: payload.weight },
  });
  revalidateBrandPage(brand.slug);
}

export async function removeBrandPillar(brandId: string, pillarId: string): Promise<void> {
  const { session, brand } = await requireOwnedBrand(brandId);
  const admin = getAdminClient();
  const { error } = await admin
    .from("brand_pillars")
    .delete()
    .eq("id", pillarId)
    .eq("brand_id", brandId);
  if (error) throw new Error(`Errore rimozione rubrica: ${error.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand_kit.pillar_removed",
    target: `brand:${brand.slug}`,
    details: { pillarId },
  });
  revalidateBrandPage(brand.slug);
}

export async function moveBrandPillar(
  brandId: string,
  pillarId: string,
  direction: "up" | "down",
): Promise<void> {
  const { session, brand } = await requireOwnedBrand(brandId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  const { data: pillars, error: eList } = await admin
    .from("brand_pillars")
    .select("id, sort_order")
    .eq("brand_id", brandId)
    .order("sort_order");
  if (eList) throw new Error(`Errore lettura rubriche: ${eList.message}`);

  const list = (pillars ?? []) as Array<{ id: string; sort_order: number }>;
  const idx = list.findIndex((p) => p.id === pillarId);
  if (idx < 0) throw new Error("Rubrica non trovata");
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) return; // già in alto/basso, no-op

  const current = list[idx]!;
  const swap = list[swapIdx]!;
  // Scambia i sort_order via due update sequenziali (tabella piccola, no bulk).
  const { error: e1 } = await admin
    .from("brand_pillars")
    .update({ sort_order: swap.sort_order })
    .eq("id", current.id);
  if (e1) throw new Error(`Errore riordino (fase 1): ${e1.message}`);
  const { error: e2 } = await admin
    .from("brand_pillars")
    .update({ sort_order: current.sort_order })
    .eq("id", swap.id);
  if (e2) throw new Error(`Errore riordino (fase 2): ${e2.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand_kit.pillar_moved",
    target: `brand:${brand.slug}`,
    details: { pillarId, direction },
  });
  revalidateBrandPage(brand.slug);
}

// ─── PAROLE BANDITE (RF-2.5) ───────────────────────────────────────────────────

export async function addBrandForbiddenWord(brandId: string, word: string): Promise<void> {
  const { session, brand } = await requireOwnedBrand(brandId);
  const trimmed = word.trim();
  if (trimmed.length < 1 || trimmed.length > 100) {
    throw new Error("Parola non valida (1-100 caratteri)");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin
    .from("brand_forbidden_words")
    .insert({ brand_id: brandId, word: trimmed });
  if (error) {
    if (error.code === "23505") throw new Error("Parola già presente per questo marchio");
    throw new Error(`Errore aggiunta parola: ${error.message}`);
  }

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand_kit.forbidden_word_added",
    target: `brand:${brand.slug}`,
    details: { word: trimmed },
  });
  revalidateBrandPage(brand.slug);
}

export async function removeBrandForbiddenWord(brandId: string, wordId: string): Promise<void> {
  const { session, brand } = await requireOwnedBrand(brandId);
  const admin = getAdminClient();
  const { error } = await admin
    .from("brand_forbidden_words")
    .delete()
    .eq("id", wordId)
    .eq("brand_id", brandId);
  if (error) throw new Error(`Errore rimozione parola: ${error.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand_kit.forbidden_word_removed",
    target: `brand:${brand.slug}`,
    details: { wordId },
  });
  revalidateBrandPage(brand.slug);
}

// ─── ARGOMENTI SENSIBILI (RF-2.5) ──────────────────────────────────────────────

export async function addBrandSensitiveTopic(
  brandId: string,
  payload: { topic: string; kind: SensitiveTopicKind; note: string },
): Promise<void> {
  const { session, brand } = await requireOwnedBrand(brandId);
  const topic = payload.topic.trim();
  if (topic.length < 1 || topic.length > 200) {
    throw new Error("Argomento non valido (1-200 caratteri)");
  }
  if (payload.note.length > 500) throw new Error("Nota troppo lunga (max 500 caratteri)");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const { error } = await admin.from("brand_sensitive_topics").insert({
    brand_id: brandId,
    topic,
    kind: payload.kind,
    note: payload.note,
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("Argomento già presente per questo marchio con lo stesso tipo");
    throw new Error(`Errore aggiunta argomento: ${error.message}`);
  }

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand_kit.sensitive_topic_added",
    target: `brand:${brand.slug}`,
    details: { topic, kind: payload.kind },
  });
  revalidateBrandPage(brand.slug);
}

export async function removeBrandSensitiveTopic(brandId: string, topicId: string): Promise<void> {
  const { session, brand } = await requireOwnedBrand(brandId);
  const admin = getAdminClient();
  const { error } = await admin
    .from("brand_sensitive_topics")
    .delete()
    .eq("id", topicId)
    .eq("brand_id", brandId);
  if (error) throw new Error(`Errore rimozione argomento: ${error.message}`);

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "brand_kit.sensitive_topic_removed",
    target: `brand:${brand.slug}`,
    details: { topicId },
  });
  revalidateBrandPage(brand.slug);
}
