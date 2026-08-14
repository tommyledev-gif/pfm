import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = 4;

export function NotificationListSkeleton() {
  return (
    <div data-testid="skeleton-notifications" className="divide-y rounded-md border">
      {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="w-full space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}
