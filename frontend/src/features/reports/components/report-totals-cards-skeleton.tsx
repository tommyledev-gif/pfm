import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_CARDS = 2;

export function ReportTotalsCardsSkeleton() {
  return (
    <div data-testid="skeleton-report-totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: SKELETON_CARDS }).map((_, index) => (
        <Card key={index}>
          <CardHeader>
            <Skeleton className="h-5 w-16" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
