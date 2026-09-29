// M10 — logica core per submitSignupPublic (server, no auth).
// Sequenza (RF-10.1..10.3):
//   1. Rate-limit check (max 3 signup / 15min per ipHash)
//   2. Dedup contatto per email/telefono/whatsapp all'interno di (org, brand)
//   3. Se nuovo: crea contact con tag audience (residente/pendolare/turista/altro)
//      Se esistente: aggiorna solo se mancano dati
//   4. Upsert consensi per ogni canale selezionato (RF-1.4 tramite m01-data-hub)
//   5. Se landing ha welcome_offer_id: emette voucher benvenuto (m06-loyalty)
//   6. Registra evento signup_events (audit + attribuzione futura)
//
// Non usa capability check — è la SOLA action pubblica dell'app, protetta da:
// - rate-limit
// - honeypot lato UI
// - validazione input
// - non ritorna PII sensibili in risposta

import { createHash } from "node:crypto";
import { getAdminClient } from "@/lib/db/admin";
import { issueVoucherForSignup } from "@/modules/m06-loyalty/public";
import { scheduleWelcomeReminder } from "@/modules/m09-reminders/public";
import { getPublicLandingBySlug } from "./landings-repo";
import { countRecentEventsByIp, insertSignupEvent } from "./events-repo";
import type { AudienceKind, ConsentChannel } from "./signup-types";

export type PublicSignupInput = {
  landingSlug: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  audienceKind?: AudienceKind;
  channelsGranted: ConsentChannel[];
  ipAddress?: string; // per hashing anti-abuse, mai persistito in chiaro
  honeypot?: string; // deve essere vuoto: campo nascosto in UI
};

export type PublicSignupResult =
  | { ok: true; welcomeCode: string | null; message: string }
  | {
      ok: false;
      error: string;
      kind?: "rate_limit" | "landing_missing" | "invalid_input" | "honeypot";
    };

const RATE_LIMIT_WINDOW_MIN = 15;
const RATE_LIMIT_MAX = 3;

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

/**
 * Cerca un contatto esistente per (org, brand) matching su email/phone/whatsapp.
 * Ritorna il primo che matcha (priorità email > phone > whatsapp).
 * Ignora contatti archiviati.
 */
async function findExistingContact(
  organizationId: string,
  brandId: string,
  email: string | null,
  phone: string | null,
  whatsapp: string | null,
): Promise<{ id: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;

  if (email) {
    const { data } = await admin
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("brand_id", brandId)
      .ilike("email", email)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    if (data) return data as { id: string };
  }
  if (phone) {
    const { data } = await admin
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("brand_id", brandId)
      .eq("phone", phone)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    if (data) return data as { id: string };
  }
  if (whatsapp) {
    const { data } = await admin
      .from("contacts")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("brand_id", brandId)
      .eq("whatsapp", whatsapp)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    if (data) return data as { id: string };
  }
  return null;
}

export async function submitPublicSignup(input: PublicSignupInput): Promise<PublicSignupResult> {
  // 1. Honeypot: se il campo è compilato → bot
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return { ok: false, error: "Compilazione non valida", kind: "honeypot" };
  }

  // 2. Validazione input base
  const email = input.email ? normalizeEmail(input.email) : null;
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const whatsapp = input.whatsapp ? normalizePhone(input.whatsapp) : null;

  if (!email && !phone && !whatsapp) {
    return {
      ok: false,
      error: "Serve almeno un recapito (email, telefono o WhatsApp)",
      kind: "invalid_input",
    };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Email non valida", kind: "invalid_input" };
  }
  if (input.channelsGranted.length === 0) {
    return {
      ok: false,
      error: "Seleziona almeno un canale per riceverci",
      kind: "invalid_input",
    };
  }
  // Consenso su canale sensato: non puoi dare consenso email se non hai email
  for (const ch of input.channelsGranted) {
    if (ch === "email" && !email) {
      return { ok: false, error: "Per email serve l'indirizzo email", kind: "invalid_input" };
    }
    if (ch === "sms" && !phone) {
      return { ok: false, error: "Per SMS serve il numero di telefono", kind: "invalid_input" };
    }
    if (ch === "whatsapp" && !whatsapp) {
      return {
        ok: false,
        error: "Per WhatsApp serve il numero WhatsApp",
        kind: "invalid_input",
      };
    }
  }

  // 3. Lookup landing
  const landing = await getPublicLandingBySlug(input.landingSlug);
  if (!landing) {
    return { ok: false, error: "Landing non trovata o non attiva", kind: "landing_missing" };
  }

  // 4. Rate-limit
  const ipHash = input.ipAddress ? hashIp(input.ipAddress) : null;
  if (ipHash) {
    const recent = await countRecentEventsByIp(ipHash, RATE_LIMIT_WINDOW_MIN);
    if (recent >= RATE_LIMIT_MAX) {
      return {
        ok: false,
        error: "Troppe iscrizioni recenti. Riprova tra qualche minuto.",
        kind: "rate_limit",
      };
    }
  }

  // 5. Dedup contatto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const existing = await findExistingContact(
    landing.organizationId,
    landing.brandId,
    email,
    phone,
    whatsapp,
  );

  let contactId: string;
  if (existing) {
    contactId = existing.id;
    // Aggiorna eventuali dati mancanti (name/other recapiti) senza sovrascrivere se già presenti
    const patch: Record<string, unknown> = {};
    if (input.firstName) patch["first_name"] = input.firstName.trim();
    if (input.lastName) patch["last_name"] = input.lastName.trim();
    if (email) patch["email"] = email;
    if (phone) patch["phone"] = phone;
    if (whatsapp) patch["whatsapp"] = whatsapp;
    // Tag audience nuovi (append, non replace)
    if (input.audienceKind) {
      patch["tags"] = [input.audienceKind];
    }
    // Update solo campi assenti — read prima, patch poi
    if (Object.keys(patch).length > 0) {
      const { data: current } = await admin
        .from("contacts")
        .select("first_name, last_name, email, phone, whatsapp, tags")
        .eq("id", contactId)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cur = current as any;
      const finalPatch: Record<string, unknown> = {};
      if (patch["first_name"] && !cur?.first_name) finalPatch["first_name"] = patch["first_name"];
      if (patch["last_name"] && !cur?.last_name) finalPatch["last_name"] = patch["last_name"];
      if (patch["email"] && !cur?.email) finalPatch["email"] = patch["email"];
      if (patch["phone"] && !cur?.phone) finalPatch["phone"] = patch["phone"];
      if (patch["whatsapp"] && !cur?.whatsapp) finalPatch["whatsapp"] = patch["whatsapp"];
      // Tag: uniamo esistenti + audience
      if (input.audienceKind) {
        const existingTags = ((cur?.tags ?? []) as string[]) ?? [];
        if (!existingTags.includes(input.audienceKind)) {
          finalPatch["tags"] = [...existingTags, input.audienceKind];
        }
      }
      if (Object.keys(finalPatch).length > 0) {
        await admin.from("contacts").update(finalPatch).eq("id", contactId);
      }
    }
  } else {
    // Nuovo contatto
    const insertRow: Record<string, unknown> = {
      organization_id: landing.organizationId,
      brand_id: landing.brandId,
      source: "qr", // convenzione per landing pubbliche
      first_name: input.firstName?.trim() ?? null,
      last_name: input.lastName?.trim() ?? null,
      email,
      phone,
      whatsapp,
      tags: input.audienceKind ? [input.audienceKind] : [],
    };
    const { data, error } = await admin.from("contacts").insert(insertRow).select("id").single();
    if (error) {
      return { ok: false, error: `Errore creazione contatto: ${error.message}` };
    }
    contactId = (data as { id: string }).id;
  }

  // 6. Upsert consensi per canale
  for (const channel of input.channelsGranted) {
    const now = new Date().toISOString();
    const { data: existingConsent } = await admin
      .from("contact_consents")
      .select("id, status")
      .eq("organization_id", landing.organizationId)
      .eq("contact_id", contactId)
      .eq("channel", channel)
      .maybeSingle();
    const consentRow: Record<string, unknown> = {
      organization_id: landing.organizationId,
      contact_id: contactId,
      channel,
      status: "granted",
      granted_at: now,
      revoked_at: null,
      source: "qr",
      evidence_text: `Iscrizione via landing "${landing.slug}"`,
    };
    if (existingConsent) {
      await admin
        .from("contact_consents")
        .update(consentRow)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("id", (existingConsent as any).id);
    } else {
      await admin.from("contact_consents").insert(consentRow);
    }
  }

  // 7. Voucher benvenuto se offerta collegata (delegato a m06-loyalty)
  let welcomeVoucherId: string | null = null;
  let welcomeCode: string | null = null;
  if (landing.welcomeOfferId) {
    const result = await issueVoucherForSignup({
      organizationId: landing.organizationId,
      offerId: landing.welcomeOfferId,
      contactId,
      notes: `Voucher benvenuto via landing "${landing.slug}"`,
    });
    if (result.ok) {
      welcomeVoucherId = result.voucherId;
      welcomeCode = result.code;
    }
    // Se emissione fallisce, procediamo comunque con signup (best-effort)
  }

  // 8. Registra evento
  await insertSignupEvent({
    organizationId: landing.organizationId,
    landingId: landing.id,
    contactId,
    audienceKind: input.audienceKind ?? null,
    channelsGranted: input.channelsGranted,
    welcomeVoucherId,
    sourceHint: "qr",
    ipHash,
  });

  // 9. RF-6.22: schedula reminder benvenuto (idempotente via UNIQUE parziale)
  try {
    await scheduleWelcomeReminder({
      organizationId: landing.organizationId,
      brandId: landing.brandId,
      contactId,
    });
  } catch {
    // Se schedule fallisce (es. già presente), non è bloccante per il signup
  }

  return {
    ok: true,
    welcomeCode,
    message: welcomeCode
      ? `Iscrizione confermata! Il tuo codice benvenuto: ${welcomeCode}`
      : "Iscrizione confermata!",
  };
}
