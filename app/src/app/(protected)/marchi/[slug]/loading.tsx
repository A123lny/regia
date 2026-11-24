import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function BrandKitLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 animate-pulse rounded bg-surface-muted" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-5 w-40 animate-pulse rounded bg-surface-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-24 w-full animate-pulse rounded bg-surface-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
