// M03 — RF-12.3 Equilibrio editoriale.
// Classifica i drafts degli ultimi N giorni per topic_label (RF-12.2) e segnala sbilanciamenti.
//
// Fallback per drafts pre-migration (topic_label = null): applica classifier al volo su theme_input.
// Escludi drafts di test [SEED] dal calcolo (rumore dati sviluppo).

import { getAdminClient } from "@/lib/db/admin";
import { classifyTopicLabel, TOPIC_LABEL_UI, type TopicLabel } from "./topic-classifier";

export type EditorialBalance = {
  totalDrafts: number;
  categories: Array<{
    category: string;
    label: string; // display name italiano
    color: string;
    count: number;
    percent: number;
    isImbalanced: "over" | "under" | null;
  }>;
  daysWindow: number;
};

function isSeedTheme(theme: string): boolean {
  return /^\[SEED\]/i.test(theme);
}

export async function computeEditorialBalance(
  organizationId: string,
  daysWindow: number = 30,
): Promise<EditorialBalance> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = getAdminClient() as any;
  const from = new Date();
  from.setDate(from.getDate() - daysWindow);
  const fromIso = from.toISOString();

  const { data, error } = await admin
    .from("content_drafts")
    .select("theme_input, topic_label")
    .eq("organization_id", organizationId)
    .gte("created_at", fromIso)
    .in("status", ["approved", "scheduled", "published"]);
  if (error) throw new Error(`Errore equilibrio editoriale: ${error.message}`);

  const rows = (data ?? []) as Array<{ theme_input: string; topic_label: string | null }>;

  const counts = new Map<TopicLabel, number>();
  for (const r of rows) {
    if (isSeedTheme(r.theme_input)) continue;
    const label = (r.topic_label as TopicLabel | null) ?? classifyTopicLabel(r.theme_input);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const total = Array.from(counts.values()).reduce((s, n) => s + n, 0);
  if (total === 0) {
    return { totalDrafts: 0, categories: [], daysWindow };
  }

  const numCats = counts.size;
  const expectedPercent = 100 / numCats;
  // Sbilanciamento se differenza dal previsto supera 20 punti percentuali
  const IMBALANCE_THRESHOLD = 20;

  const categories = Array.from(counts.entries())
    .map(([category, count]) => {
      const percent = Math.round((count / total) * 100);
      const diff = percent - expectedPercent;
      const isImbalanced: "over" | "under" | null =
        Math.abs(diff) >= IMBALANCE_THRESHOLD && numCats >= 2
          ? diff > 0
            ? "over"
            : "under"
          : null;
      const ui = TOPIC_LABEL_UI[category];
      return {
        category,
        label: ui.label,
        color: ui.color,
        count,
        percent,
        isImbalanced,
      };
    })
    .sort((a, b) => b.count - a.count);

  return { totalDrafts: total, categories, daysWindow };
}
