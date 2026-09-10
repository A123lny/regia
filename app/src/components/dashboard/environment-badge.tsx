import type { Environment } from "@/modules/m12-daily-use/public";

const LABELS: Record<Environment, string> = {
  "sviluppo-locale": "Sviluppo locale",
  staging: "Staging",
  produzione: "Produzione",
};

const COLORS: Record<Environment, string> = {
  "sviluppo-locale": "bg-secondary/15 text-secondary border-secondary/30",
  staging: "bg-warning/15 text-warning border-warning/30",
  produzione: "bg-primary/15 text-primary border-primary/30",
};

export function EnvironmentBadge({ environment }: { environment: Environment }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${COLORS[environment]}`}
    >
      {LABELS[environment]}
    </span>
  );
}
