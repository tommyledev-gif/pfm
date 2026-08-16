import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { Wallet } from "@/features/wallets/types";

// Backend wraps list responses one level deeper than a single-object
// response: `response.Success(c, ..., dto.NewListWalletsResponse(wallets))`
// puts a `{data: [...]}` DTO into the envelope's own `data` field, so the
// wire shape is `{success, message, data: {data: Wallet[]}}` — not
// `{success, message, data: Wallet[]}`. Unwrapped here so every caller still
// gets a flat `Wallet[]`.
export function useWalletsQuery() {
  return useQuery({
    queryKey: ["wallets"],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: { data: Wallet[] } }>("/wallets/");
      return unwrap(res.data).data;
    },
  });
}
