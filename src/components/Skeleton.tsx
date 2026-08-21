export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton h-40" />
      <div className="p-4 space-y-3">
        <SkeletonLine className="h-5 w-3/4" />
        <SkeletonLine className="h-3 w-1/2" />
        <SkeletonLine className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function SkeletonCardGrid({ count = 6, className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5' }: { count?: number; className?: string }) {
  return (
    <div className={className}>
      {[...Array(count)].map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonCarousel({ count = 4 }: { count?: number }) {
  return (
    <div className="carousel-track">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="carousel-item w-64">
          <SkeletonCard />
        </div>
      ))}
    </div>
  );
}
