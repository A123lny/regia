"use server";

// Inserimento manuale recensioni (singola o via import CSV).
// Classificazione automatica alla ricezione; status iniziale = serious_signaled
// se classifier flagga, altrimenti pending (stesso flusso del fetcher Google).

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { getSessionOrRedirect } from "@/lib/auth/session";
import { requireCapability } from "@/lib/auth/permissions";
import { getBrandById } from "@/modules/m02-brand/public";
import { logAuditEvent } from "@/lib/audit/log";
import { insertReviewFromFetch } from "./reviews-repo";
import { classifyReview } from "./classifier";

export type ManualInsertResult = { ok: true; reviewId: string } | { ok: false; error: string };

export async function insertManualReviewAction(input: {
  brandId: string;
  authorName: string;
  rating: number;
  text: string;
  postedAt?: string; // ISO; default: ora
}): Promise<ManualInsertResult> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "reviews.respond");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }

  const brand = await getBrandById(session.organizationId, input.brandId);
  if (!brand) return { ok: false, error: "Marchio non trovato." };

  const rating = Number(input.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: "Voto non valido (deve essere tra 1 e 5)." };
  }
  const authorName = (input.authorName ?? "").trim().slice(0, 120);
  if (!authorName) return { ok: false, error: "Nome autore mancante." };
  const text = (input.text ?? "").trim().slice(0, 4000);
  if (!text) return { ok: false, error: "Testo recensione mancante." };

  const postedAt =
    input.postedAt && !Number.isNaN(Date.parse(input.postedAt))
      ? new Date(input.postedAt).toISOString()
      : new Date().toISOString();

  const cls = classifyReview(rating, text);
  const externalId = `manual-${randomUUID()}`;
  try {
    const review = await insertReviewFromFetch({
      organizationId: session.organizationId,
      brandId: brand.id,
      externalId,
      authorName,
      rating,
      textOriginal: text,
      postedAt,
      classification: cls.classification,
      classificationReason: cls.reason,
    });
    if (!review) {
      return { ok: false, error: "Recensione già presente (ID duplicato)." };
    }
    await logAuditEvent({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      actorKind: "user",
      action: "reviews.manual_inserted",
      target: `review:${review.id}`,
      details: {
        source: "manual",
        brandSlug: brand.slug,
        rating,
        classification: cls.classification,
      },
    });
    revalidatePath("/recensioni");
    return { ok: true, reviewId: review.id };
  } catch (err) {
    console.error("[reviews] manual insert failed", {
      brandSlug: brand.slug,
      err: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "Errore inserimento recensione." };
  }
}

export type CsvImportResult =
  { ok: true; imported: number; skipped: number; errors: string[] } | { ok: false; error: string };

/**
 * Importa recensioni da CSV. Formato atteso (header obbligatorio prima riga):
 *   author_name,rating,text,posted_at
 * posted_at è opzionale (fallback: ora). CSV piccoli (< 200 righe): nessuna
 * ottimizzazione batch. Errori per riga: continua il resto.
 */
export async function importReviewsCsvAction(input: {
  brandId: string;
  csv: string;
}): Promise<CsvImportResult> {
  const session = await getSessionOrRedirect();
  try {
    requireCapability(session, "reviews.respond");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Non autorizzato." };
  }

  const brand = await getBrandById(session.organizationId, input.brandId);
  if (!brand) return { ok: false, error: "Marchio non trovato." };

  const csv = (input.csv ?? "").trim();
  if (!csv) return { ok: false, error: "CSV vuoto." };

  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { ok: false, error: "CSV deve avere intestazione + almeno una riga." };
  }
  if (lines.length > 500) {
    return { ok: false, error: "Troppe righe (max 500 per import)." };
  }

  const firstLine = lines[0];
  if (!firstLine) return { ok: false, error: "CSV vuoto." };
  const header = parseCsvRow(firstLine).map((h) => h.toLowerCase().trim());
  const idxAuthor = header.indexOf("author_name");
  const idxRating = header.indexOf("rating");
  const idxText = header.indexOf("text");
  const idxDate = header.indexOf("posted_at");
  if (idxAuthor < 0 || idxRating < 0 || idxText < 0) {
    return {
      ok: false,
      error:
        "Header CSV incompleto. Colonne richieste: author_name, rating, text (posted_at opzionale).",
    };
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine) continue;
    const row = parseCsvRow(rawLine);
    try {
      const authorName = (row[idxAuthor] ?? "").trim();
      const rating = Number(row[idxRating] ?? "");
      const text = (row[idxText] ?? "").trim();
      const postedRaw = idxDate >= 0 ? (row[idxDate] ?? "").trim() : "";
      if (!authorName || !text || !Number.isFinite(rating) || rating < 1 || rating > 5) {
        skipped++;
        errors.push(`Riga ${i + 1}: dati non validi.`);
        continue;
      }
      const postedAt =
        postedRaw && !Number.isNaN(Date.parse(postedRaw))
          ? new Date(postedRaw).toISOString()
          : new Date().toISOString();
      const cls = classifyReview(rating, text);
      const r = await insertReviewFromFetch({
        organizationId: session.organizationId,
        brandId: brand.id,
        externalId: `csv-${randomUUID()}`,
        authorName: authorName.slice(0, 120),
        rating,
        textOriginal: text.slice(0, 4000),
        postedAt,
        classification: cls.classification,
        classificationReason: cls.reason,
      });
      if (r) {
        imported++;
      } else {
        skipped++;
      }
    } catch (err) {
      skipped++;
      errors.push(`Riga ${i + 1}: ${err instanceof Error ? err.message : "errore"}`);
    }
  }

  await logAuditEvent({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorKind: "user",
    action: "reviews.csv_imported",
    target: `brand:${brand.slug}`,
    details: { imported, skipped, totalRows: lines.length - 1 },
  });
  revalidatePath("/recensioni");
  return { ok: true, imported, skipped, errors: errors.slice(0, 20) };
}

// Parser CSV minimale: gestisce virgolette doppie + escape "" . Non supporta
// multi-line fields. Sufficient per import "piatto".
function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') {
        inQuote = true;
      } else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}
