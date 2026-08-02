import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteBudgetDialog } from "@/features/budgets/components/delete-budget-dialog";
import { EditBudgetDialog } from "@/features/budgets/components/edit-budget-dialog";
import type { Budget } from "@/features/budgets/types";
import { formatCurrency } from "@/lib/currency";
import { ROUTES } from "@/lib/constants";

interface BudgetTableProps {
  budgets: Budget[];
}

export function BudgetTable({ budgets }: BudgetTableProps) {
  if (budgets.length === 0) {
    return (
      <p data-testid="text-budgets-empty" className="py-8 text-center text-sm text-muted-foreground">
        No budgets yet — create one to start tracking spend against a category.
      </p>
    );
  }

  return (
    <Table data-testid="table-budgets">
      <TableHeader>
        <TableRow>
          <TableHead>Category</TableHead>
          <TableHead>Limits</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {budgets.map((budget) => (
          <TableRow key={budget.id}>
            <TableCell className="font-medium">
              <Link href={`${ROUTES.budgets}/${budget.id}`} className="hover:underline">
                {budget.category_name}
              </Link>
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1 text-sm">
                {budget.limits.map((limit) => (
                  <span key={limit.currency}>
                    {formatCurrency(limit.spent, limit.currency)} / {formatCurrency(limit.amount_limit, limit.currency)}
                  </span>
                ))}
              </div>
            </TableCell>
            <TableCell>
              <Badge data-testid="badge-budget-status" variant={budget.status === "exceeded" ? "destructive" : "secondary"}>
                {budget.status}
              </Badge>
            </TableCell>
            <TableCell className="flex justify-end gap-2">
              <Button asChild variant="ghost" size="sm" data-testid="btn-view-budget">
                <Link href={`${ROUTES.budgets}/${budget.id}`}>View</Link>
              </Button>
              <EditBudgetDialog budget={budget} />
              <DeleteBudgetDialog budget={budget} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
