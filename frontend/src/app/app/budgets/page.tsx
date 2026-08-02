"use client";

import { ErrorBanner } from "@/components/shared/error-banner";
import { PageHeader } from "@/components/shared/page-header";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { BudgetTable } from "@/features/budgets/components/budget-table";
import { BudgetTableSkeleton } from "@/features/budgets/components/budget-table-skeleton";
import { CreateBudgetDialog } from "@/features/budgets/components/create-budget-dialog";

export default function BudgetsPage() {
  const { data, isLoading, isError } = useBudgetsQuery();

  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Set spending limits per category, tracked across all your wallets."
        actions={<CreateBudgetDialog />}
      />

      {isError && <ErrorBanner message="Failed to load budgets." />}
      {isLoading && <BudgetTableSkeleton />}
      {!isLoading && data && <BudgetTable budgets={data.data} />}
    </div>
  );
}
