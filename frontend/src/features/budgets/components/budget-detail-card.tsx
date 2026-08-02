"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteBudgetDialog } from "@/features/budgets/components/delete-budget-dialog";
import { EditBudgetDialog } from "@/features/budgets/components/edit-budget-dialog";
import type { Budget } from "@/features/budgets/types";
import { formatCurrency } from "@/lib/currency";
import { ROUTES } from "@/lib/constants";

interface BudgetDetailCardProps {
  budget: Budget;
}

export function BudgetDetailCard({ budget }: BudgetDetailCardProps) {
  const router = useRouter();

  return (
    <Card data-testid="card-budget-detail">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <CardTitle>{budget.category_name}</CardTitle>
          <Badge data-testid="badge-budget-status" variant={budget.status === "exceeded" ? "destructive" : "secondary"}>
            {budget.status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <EditBudgetDialog budget={budget} />
          <DeleteBudgetDialog budget={budget} onDeleted={() => router.push(ROUTES.budgets)} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Period</dt>
          <dd className="capitalize">{budget.period}</dd>
          <dt className="text-muted-foreground">Start date</dt>
          <dd>{budget.start_date}</dd>
        </dl>

        <div className="space-y-2">
          {budget.limits.map((limit) => (
            <div key={limit.currency} data-testid="progress-budget-currency" className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{limit.currency}</span>
                <Badge variant={limit.status === "exceeded" ? "destructive" : "secondary"}>{limit.status}</Badge>
              </div>
              <div className="mt-1 text-muted-foreground">
                {formatCurrency(limit.spent, limit.currency)} spent of {formatCurrency(limit.amount_limit, limit.currency)}
                {" "}
                ({formatCurrency(limit.remaining, limit.currency)} remaining)
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
