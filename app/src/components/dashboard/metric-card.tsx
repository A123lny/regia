import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MetricCard({
  label,
  value,
  footer,
}: {
  label: string;
  value: number | string;
  footer?: string;
}) {
  return (
    <Card className="border-border bg-surface">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-text-muted">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-serif text-3xl font-semibold text-text">{value}</div>
        {footer && <p className="mt-1 text-xs text-text-muted">{footer}</p>}
      </CardContent>
    </Card>
  );
}
