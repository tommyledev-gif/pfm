import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ConsultRequest, ConsultResponse } from "@/features/analytics/types";

export function useConsultMutation() {
  return useMutation({
    mutationFn: async (body: ConsultRequest) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: ConsultResponse }>(
        "/analytics/consult",
        body,
      );
      return unwrap(res.data);
    },
  });
}
