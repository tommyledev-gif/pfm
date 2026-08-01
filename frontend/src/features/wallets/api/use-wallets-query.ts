import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { ListWalletsResult } from "@/features/wallets/types";

async function fetchWallets(): Promise<ListWalletsResult> {
  const { data } = await apiClient.get<ApiEnvelope<ListWalletsResult>>("/wallets");
  return unwrap(data);
}

export function useWalletsQuery() {
  return useQuery({
    queryKey: ["wallets"],
    queryFn: fetchWallets,
  });
}
