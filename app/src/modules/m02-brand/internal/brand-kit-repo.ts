// M02 Brand — repository: query DB + helper AI (RF-2.3, RF-2.3a, RF-2.4, RF-2.5).
// RS-2: usa getAdminClient() wrapper, no SDK Supabase diretto.

import { getAdminClient } from "@/lib/db/admin";
import type {
  BrandKit,
  BrandPillar,
  BrandForbiddenWord,
  BrandSensitiveTopic,
  BrandKitWithLists,
  SensitiveTopicKind,
  ToneExample,
} from "./brand-kit-types";

type BrandKitRow = {
  brand_id: string;
  tone_of_voice: string;
  strategic_purpose: string;
  strategic_year_goal: string;
  strategic_direction: string;
  tone_examples: ToneExample[];
  updated_at: string;
};

type BrandPillarRow = {
  id: string;
  brand_id: string;
  name: string;
  weight: number;
  sort_order: number;
  created_at: string;
};

type BrandForbiddenWordRow = {
  id: string;
  brand_id: string;
  word: string;
  created_at: string;
};

type BrandSensitiveTopicRow = {
  id: string;
  brand_id: string;
  topic: string;
  kind: string;
  note: string;
  created_at: string;
};

function mapKit(row: BrandKitRow): BrandKit {
  return {
    brandId: row.brand_id,
    toneOfVoice: row.tone_of_voice,
    strategicPurpose: row.strategic_purpose,
    strategicYearGoal: row.strategic_year_goal,
    strategicDirection: row.strategic_direction,
    toneExamples: Array.isArray(row.tone_examples) ? row.tone_examples : [],
    updatedAt: row.updated_at,
  };
}

function mapPillar(row: BrandPillarRow): BrandPillar {
  return {
    id: row.id,
    brandId: row.brand_id,
    name: row.name,
    weight: row.weight,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapForbidden(row: BrandForbiddenWordRow): BrandForbiddenWord {
  return {
    id: row.id,
    brandId: row.brand_id,
    word: row.word,
    createdAt: row.created_at,
  };
}

function mapSensitive(row: BrandSensitiveTopicRow): BrandSensitiveTopic {
  return {
    id: row.id,
    brandId: row.brand_id,
    topic: row.topic,
    kind: row.kind as SensitiveTopicKind,
    note: row.note,
    createdAt: row.created_at,
  };
}

/**
 * Carica il brand kit completo di un marchio con tutte le liste correlate.
 * Ritorna null se il marchio non ha ancora un brand_kit (edge case: brand creato
 * dopo il seed senza upsert kit). In quel caso la UI crea la riga al primo save.
 */
export async function getBrandKitWithLists(brandId: string): Promise<BrandKitWithLists | null> {
  const admin = getAdminClient();

  const [kitRes, pillarsRes, forbRes, sensRes] = await Promise.all([
    admin.from("brand_kits").select("*").eq("brand_id", brandId).maybeSingle(),
    admin.from("brand_pillars").select("*").eq("brand_id", brandId).order("sort_order"),
    admin.from("brand_forbidden_words").select("*").eq("brand_id", brandId).order("word"),
    admin
      .from("brand_sensitive_topics")
      .select("*")
      .eq("brand_id", brandId)
      .order("kind")
      .order("topic"),
  ]);

  if (kitRes.error) throw new Error(`brand_kits query failed: ${kitRes.error.message}`);
  if (!kitRes.data) return null;

  return {
    kit: mapKit(kitRes.data as BrandKitRow),
    pillars: ((pillarsRes.data ?? []) as BrandPillarRow[]).map(mapPillar),
    forbiddenWords: ((forbRes.data ?? []) as BrandForbiddenWordRow[]).map(mapForbidden),
    sensitiveTopics: ((sensRes.data ?? []) as BrandSensitiveTopicRow[]).map(mapSensitive),
  };
}

/**
 * Formatta il brand kit come Markdown pronto per essere iniettato come
 * contesto obbligatorio nei prompt AI di M3 (RF-2.3, RF-2.3a).
 * Ritorna stringa vuota se il marchio non ha ancora un brand_kit configurato.
 */
export async function formatBrandContextForAI(brandId: string): Promise<string> {
  const bundle = await getBrandKitWithLists(brandId);
  if (!bundle) return "";

  const admin = getAdminClient();
  const { data: brandRow } = await admin
    .from("brands")
    .select("display_name")
    .eq("id", brandId)
    .single();
  const displayName = (brandRow as { display_name?: string } | null)?.display_name ?? "Marchio";

  const lines: string[] = [];
  lines.push(`# Contesto di marca — ${displayName}`);
  lines.push("");
  lines.push("## Tono di voce");
  lines.push(bundle.kit.toneOfVoice || "_Non impostato._");
  lines.push("");
  if (bundle.kit.toneExamples.length > 0) {
    // RN-70: iniezione few-shot. Il modello calibra lo stile su esempi reali
    // scelti dall'owner, con nota su cosa funzionava di ciascuno.
    lines.push("## Esempi di tono (post passati scelti dall'owner — RN-70)");
    for (const ex of bundle.kit.toneExamples) {
      lines.push(`- "${ex.text.replace(/\n+/g, " ").trim()}"`);
      if (ex.note.trim().length > 0) {
        lines.push(`  _Perché funziona:_ ${ex.note.trim()}`);
      }
    }
    lines.push("");
  }
  lines.push("## Contesto strategico");
  lines.push(`- **Scopo e pubblico:** ${bundle.kit.strategicPurpose || "_Non impostato._"}`);
  lines.push(`- **Obiettivo dell'anno:** ${bundle.kit.strategicYearGoal || "_Non impostato._"}`);
  lines.push(`- **Direzione futura:** ${bundle.kit.strategicDirection || "_Non impostato._"}`);
  lines.push("");
  lines.push("## Rubriche (con peso di frequenza)");
  if (bundle.pillars.length === 0) {
    lines.push("_Nessuna rubrica configurata._");
  } else {
    for (const p of bundle.pillars) {
      lines.push(`- **${p.name}** (peso ${p.weight})`);
    }
  }
  lines.push("");
  lines.push("## Parole bandite (mai usare)");
  if (bundle.forbiddenWords.length === 0) {
    lines.push("_Nessuna parola bandita._");
  } else {
    lines.push(bundle.forbiddenWords.map((w) => w.word).join(", "));
  }
  lines.push("");
  lines.push("## Argomenti che richiedono attenzione");
  if (bundle.sensitiveTopics.length === 0) {
    lines.push("_Nessuno._");
  } else {
    for (const s of bundle.sensitiveTopics) {
      const kindLabel = s.kind === "claim_vietato" ? "claim vietato" : "revisione umana";
      const noteBit = s.note ? ` — ${s.note}` : "";
      lines.push(`- **${s.topic}** (${kindLabel})${noteBit}`);
    }
  }

  return lines.join("\n");
}
