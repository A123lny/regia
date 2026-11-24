import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="h-10 w-48 animate-pulse rounded bg-surface-muted" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border bg-surface">
            <CardHeader className="pb-2">
              <div className="h-4 w-32 animate-pulse rounded bg-surface-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 animate-pulse rounded bg-surface-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
