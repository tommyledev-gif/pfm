"use client";

import { useState } from "react";

import { ErrorBanner } from "@/components/shared/error-banner";
import { PageHeader } from "@/components/shared/page-header";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";
import { ReportCategoryBreakdownTable } from "@/features/reports/components/report-category-breakdown-table";
import { ReportCategoryBreakdownTableSkeleton } from "@/features/reports/components/report-category-breakdown-table-skeleton";
import { ReportFiltersBar } from "@/features/reports/components/report-filters";
import { ReportTotalsCards } from "@/features/reports/components/report-totals-cards";
import { ReportTotalsCardsSkeleton } from "@/features/reports/components/report-totals-cards-skeleton";
import type { ReportFilters } from "@/features/reports/types";
import { getErrorMessage } from "@/lib/axios";

export default function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const { data, isLoading, isError, error } = useReportSummaryQuery(filters);

  return (
    <div>
      <PageHeader title="Reports" description="Review your income and expenses for a period." />

      <ReportFiltersBar filters={filters} onChange={setFilters} />

      {isError && <ErrorBanner message={getErrorMessage(error, "Failed to load report.")} />}
      {isLoading && (
        <div className="space-y-6">
          <ReportTotalsCardsSkeleton />
          <ReportCategoryBreakdownTableSkeleton />
        </div>
      )}
      {!isLoading && data && (
        <div className="space-y-6">
          <p data-testid="text-report-range" className="text-sm text-muted-foreground">
            {new Date(data.range.from).toLocaleDateString()} – {new Date(data.range.to).toLocaleDateString()}
          </p>
          <ReportTotalsCards totals={data.totals} />
          <ReportCategoryBreakdownTable entries={data.by_category} />
        </div>
      )}
    </div>
  );
}
