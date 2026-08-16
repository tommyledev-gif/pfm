import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ReportSummary, ReportSummaryFilters } from "@/features/reports/types";

export function useReportSummaryQuery(filters: ReportSummaryFilters = {}) {
  return useQuery({
    queryKey: ["report-summary", filters],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: ReportSummary }>(
        "/reports/summary",
        { params: filters },
      );
      return unwrap(res.data);
    },
  });
}
