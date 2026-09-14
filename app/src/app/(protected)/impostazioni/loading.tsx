import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ImpostazioniLoading() {
  return (
    <div className="space-y-8">
      <div className="h-10 w-48 animate-pulse rounded bg-surface-muted" />
      {[0, 1].map((i) => (
        <Card key={i} className="border-border bg-surface">
          <CardHeader>
            <div className="h-6 w-32 animate-pulse rounded bg-surface-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[0, 1, 2].map((j) => (
              <div key={j} className="space-y-1">
                <div className="h-3 w-20 animate-pulse rounded bg-surface-muted" />
                <div className="h-5 w-64 animate-pulse rounded bg-surface-muted" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
