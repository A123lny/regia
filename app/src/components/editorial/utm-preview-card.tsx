// RN-85 Anteprima link tracciati.
// Mostra ogni URL nel testo del draft con la versione UTM-tagged applicata al momento della pubblicazione.
// L'utm_source di default è "instagram" (canale di preview), ma in M14 verra sostituito dal canale reale.

import { Link2, Info } from "lucide-react";
import { extractUrls, tagUrl, composeUtmForDraft } from "@/modules/m03-editorial/public";

type Props = {
  text: string;
  brandSlug: string;
  draftId: string;
  previewPlatform?: string; // default "instagram"
};

export function UtmPreviewCard({ text, brandSlug, draftId, previewPlatform = "instagram" }: Props) {
  const urls = extractUrls(text);
  if (urls.length === 0) return null;

  const params = composeUtmForDraft({
    platformSource: previewPlatform,
    medium: "social",
    brandSlug,
    draftId,
  });

  const rows = urls.map((u, i) => ({
    key: `${i}-${u}`,
    original: u,
    tagged: tagUrl(u, params),
  }));

  return (
    <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium text-text">Link tracciati alla pubblicazione</h3>
        <span className="text-xs text-text-muted">({urls.length} link · RN-85)</span>
      </div>
      <p className="mb-3 flex items-start gap-1.5 text-xs text-text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Al momento della pubblicazione ogni URL viene marcato automaticamente con i parametri UTM
          per attribuire le visite al post. Anteprima con canale <code>{previewPlatform}</code>.
        </span>
      </p>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="rounded-md border border-border bg-surface p-2 text-xs">
            <div className="mb-1 text-text-muted">Originale:</div>
            <code className="mb-1.5 block break-all text-text">{r.original}</code>
            <div className="mb-1 text-text-muted">Con UTM:</div>
            <code className="block break-all text-primary">{r.tagged}</code>
          </li>
        ))}
      </ul>
    </section>
  );
}
