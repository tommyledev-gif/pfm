import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { SNAPSHOT_STALE_TIME_MS } from "@/lib/query-client";
import { ReportSummary, ReportSummaryFilters } from "@/features/reports/types";

interface ReportSummaryOptions {
  /** Keep showing the previous filter's report while the new one loads. */
  keepPrevious?: boolean;
}

export function useReportSummaryQuery(filters: ReportSummaryFilters = {}, { keepPrevious = false }: ReportSummaryOptions = {}) {
  return useQuery({
    queryKey: ["report-summary", filters],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: ReportSummary }>(
        "/reports/summary",
        { params: filters },
      );
      return unwrap(res.data);
    },
    staleTime: SNAPSHOT_STALE_TIME_MS,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
}
