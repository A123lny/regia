export default function AuditLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-40 animate-pulse rounded bg-surface-muted" />
      <div className="rounded-lg border border-border bg-surface p-8">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 w-full animate-pulse rounded bg-surface-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}
