export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200 dark:bg-neutral-800 ${className}`} />
}

export function SkeletonList({ rows = 5, withHeading = true }: { rows?: number; withHeading?: boolean }) {
  return (
    <div className="space-y-4">
      {withHeading && <Skeleton className="h-6 w-32" />}
      <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden divide-y divide-gray-100 dark:divide-neutral-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4">
            <Skeleton className="h-10" />
          </div>
        ))}
      </div>
    </div>
  )
}
