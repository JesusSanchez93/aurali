import { Skeleton } from '@/components/ui/skeleton';

export default function LoadingDocumentTemplates() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Table rows */}
      <div className="rounded-md border">
        <div className="border-b p-4">
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-24" />
            ))}
          </div>
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b p-4 last:border-0">
            <div className="grid grid-cols-4 gap-4 items-center">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-28" />
              <div className="flex gap-2 justify-end">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
