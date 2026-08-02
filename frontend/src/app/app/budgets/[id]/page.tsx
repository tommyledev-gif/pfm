"use client";

import { useParams } from "next/navigation";

import { ErrorBanner } from "@/components/shared/error-banner";
import { PageHeader } from "@/components/shared/page-header";
import { useBudgetQuery } from "@/features/budgets/api/use-budget-query";
import { BudgetDetailCard } from "@/features/budgets/components/budget-detail-card";
import { BudgetDetailCardSkeleton } from "@/features/budgets/components/budget-detail-card-skeleton";

export default function BudgetDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading, isError } = useBudgetQuery(params.id);

  return (
    <div>
      <PageHeader title="Budget details" />

      {isError && (
        <ErrorBanner message="Failed to load this budget — it may not exist or you may not have access to it." />
      )}
      {isLoading && <BudgetDetailCardSkeleton />}
      {!isLoading && data && <BudgetDetailCard budget={data} />}
    </div>
  );
}
