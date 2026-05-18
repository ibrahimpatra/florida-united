export function ProductSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="skeleton h-48 w-full" />
          <div className="p-4 space-y-2">
            <div className="skeleton h-3 w-1/3 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-4/5 rounded" />
            <div className="skeleton h-5 w-1/2 rounded" />
            <div className="skeleton h-8 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
