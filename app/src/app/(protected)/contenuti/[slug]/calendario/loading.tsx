export default function CalendarioLoading() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 animate-pulse rounded bg-surface-muted" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="h-[140px] animate-pulse rounded bg-surface-muted" />
        ))}
      </div>
    </div>
  );
}
