import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const SKELETON_ROWS = 3;

export function ReportCategoryBreakdownTableSkeleton() {
  return (
    <Table data-testid="skeleton-report-by-category">
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: SKELETON_ROWS }).map((_, index) => (
          <TableRow key={index}>
            <TableCell>
              <Skeleton className="h-4 w-32" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell className="flex justify-end">
              <Skeleton className="h-4 w-20" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
