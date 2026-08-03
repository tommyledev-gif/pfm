import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { ReportFilters, ReportSummary } from "@/features/reports/types";

async function fetchReportSummary(filters: ReportFilters): Promise<ReportSummary> {
  const { data } = await apiClient.get<ApiEnvelope<ReportSummary>>("/reports/summary", {
    params: {
      wallet_id: filters.walletId || undefined,
      category_id: filters.categoryId || undefined,
      type: filters.type || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    },
  });
  return unwrap(data);
}

// Single unpaginated useQuery — spec.md has no pagination on this endpoint
// (Edge Cases US-01 #6), unlike useTransactionsQuery's useInfiniteQuery.
export function useReportSummaryQuery(filters: ReportFilters) {
  return useQuery({
    queryKey: ["report-summary", filters],
    queryFn: () => fetchReportSummary(filters),
  });
}
