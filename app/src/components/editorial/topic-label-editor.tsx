// RF-12.2 override manuale topic_label su un draft.
// Server-action form. Mostra label corrente + select con i valori enum.

import { Tag } from "lucide-react";
import {
  TOPIC_LABELS,
  TOPIC_LABEL_UI,
  updateContentDraftTopicLabel,
  type TopicLabel,
} from "@/modules/m03-editorial/public";

type Props = {
  draftId: string;
  currentLabel: string | null;
  disabled?: boolean; // per drafts published/rejected → view-only
};

export function TopicLabelEditor({ draftId, currentLabel, disabled }: Props) {
  const current = (currentLabel ?? "altro") as TopicLabel;
  const currentUi = TOPIC_LABEL_UI[current];

  if (disabled) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-xs text-text-muted">
        <Tag className="h-3.5 w-3.5" />
        <span>Argomento:</span>
        <span
          className="rounded-full px-2 py-0.5 font-medium"
          style={{
            backgroundColor: `${currentUi.color}20`,
            color: currentUi.color,
            border: `1px solid ${currentUi.color}40`,
          }}
        >
          {currentUi.label}
        </span>
      </div>
    );
  }

  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        const newLabel = String(formData.get("topicLabel") ?? "");
        await updateContentDraftTopicLabel(draftId, newLabel);
      }}
      className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface p-3 text-xs"
    >
      <Tag className="h-3.5 w-3.5 text-text-muted" />
      <label htmlFor={`topic-${draftId}`} className="text-text-muted">
        Argomento (RF-12.2):
      </label>
      <select
        id={`topic-${draftId}`}
        name="topicLabel"
        defaultValue={current}
        className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text focus:border-primary focus:outline-none"
      >
        {TOPIC_LABELS.map((l) => (
          <option key={l} value={l}>
            {TOPIC_LABEL_UI[l].label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-hover"
      >
        Salva
      </button>
    </form>
  );
}
