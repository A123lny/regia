export default function MarchiLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-32 animate-pulse rounded bg-surface-muted" />
      <div className="rounded-lg border border-border bg-surface p-8">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-full animate-pulse rounded bg-surface-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
