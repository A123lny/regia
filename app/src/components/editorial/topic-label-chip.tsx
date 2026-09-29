// RF-12.2 Chip visuale per topic_label. Server component.

import { TOPIC_LABEL_UI, type TopicLabel } from "@/modules/m03-editorial/public";

type Props = {
  label: string | null;
  size?: "xs" | "sm";
};

export function TopicLabelChip({ label, size = "xs" }: Props) {
  if (!label) return null;
  const meta = TOPIC_LABEL_UI[label as TopicLabel];
  if (!meta) return null;
  const textSize = size === "xs" ? "text-[10px]" : "text-xs";
  const padding = size === "xs" ? "px-1.5 py-0.5" : "px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium uppercase tracking-wide ${textSize} ${padding}`}
      style={{
        backgroundColor: `${meta.color}20`,
        color: meta.color,
        border: `1px solid ${meta.color}40`,
      }}
    >
      {meta.label}
    </span>
  );
}
