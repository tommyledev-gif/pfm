import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";

// Standalone upload step (POST /budgets/icon) — mirrors
// use-upload-category-icon-mutation.ts exactly (specs/wallet-budget-icons/spec.md
// US-03): separate from Create/Update so a user can pick an image before the
// budget exists yet (the create form). Returns the icon_url to include on
// the eventual create/update payload.
export interface UploadBudgetIconAsset {
  uri: string;
  name: string;
  mimeType: string;
}

export function useUploadBudgetIconMutation() {
  return useMutation({
    mutationFn: async (asset: UploadBudgetIconAsset) => {
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType,
      } as unknown as Blob);

      const res = await apiClient.post<{ success: boolean; message: string; data?: { icon_url: string } }>(
        "/budgets/icon",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return unwrap(res.data);
    },
  });
}
