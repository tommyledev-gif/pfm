import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { ListUsersResult } from "@/features/users/types";

async function fetchUsers(): Promise<ListUsersResult> {
  const { data } = await apiClient.get<ApiEnvelope<ListUsersResult>>("/admin/users");
  return unwrap(data);
}

export function useUsersQuery() {
  return useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });
}
