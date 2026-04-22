import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingLegalProcess() {
  return (
    <div className="space-y-8">
      {/* Search + filter bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
        <Skeleton className="h-9 w-full sm:flex-1" />
        <Skeleton className="h-9 w-full sm:w-40" />
        <Skeleton className="h-9 w-full sm:w-36" />
      </div>

      {/* Process cards */}
      <div className="mt-8 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
