export function ClientCardSkeleton() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 animate-pulse">
      <div className="h-6 bg-white/10 rounded w-3/4 mb-3" />
      <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
      <div className="h-4 bg-white/10 rounded w-2/3" />
    </div>
  );
}

export function ClientListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <ClientCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function BureauScoreSkeleton() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 animate-pulse">
      <div className="h-5 bg-white/10 rounded w-1/3 mb-3" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-4 bg-white/10 rounded w-full" />
        ))}
      </div>
    </div>
  );
}

export function DetailViewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-white/10 rounded w-1/2" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="h-4 bg-white/10 rounded w-1/3 mb-2" />
            <div className="h-6 bg-white/10 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
