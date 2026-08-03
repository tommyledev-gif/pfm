import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ReportCategoryEntry } from "@/features/reports/types";
import { formatCurrency } from "@/lib/currency";

interface ReportCategoryBreakdownTableProps {
  entries: ReportCategoryEntry[];
}

// Ordered amount DESC by the API itself (spec.md Response Shape) — never
// re-sorted client-side.
export function ReportCategoryBreakdownTable({ entries }: ReportCategoryBreakdownTableProps) {
  if (entries.length === 0) {
    return (
      <p data-testid="text-report-by-category-empty" className="py-8 text-center text-sm text-muted-foreground">
        No category activity in this range.
      </p>
    );
  }

  return (
    <Table data-testid="table-report-by-category">
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={`${entry.category_id}-${entry.type}-${entry.currency}`}>
            <TableCell className="font-medium">{entry.category_name}</TableCell>
            <TableCell>
              <Badge variant={entry.type === "income" ? "secondary" : "outline"}>{entry.type}</Badge>
            </TableCell>
            <TableCell className="text-right">{formatCurrency(entry.amount, entry.currency)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
