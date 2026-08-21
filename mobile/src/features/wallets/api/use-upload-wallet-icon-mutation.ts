import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";

// Standalone upload step (POST /wallets/icon) — mirrors
// use-upload-category-icon-mutation.ts exactly (specs/wallet-budget-icons/spec.md
// US-01): separate from Create/Update so a user can pick an image before the
// wallet exists yet (the create form). Returns the icon_url to include on
// the eventual create/update payload.
export interface UploadWalletIconAsset {
  uri: string;
  name: string;
  mimeType: string;
}

export function useUploadWalletIconMutation() {
  return useMutation({
    mutationFn: async (asset: UploadWalletIconAsset) => {
      const form = new FormData();
      // React Native's FormData accepts this {uri, name, type} shape
      // directly — it is not a real Blob/File, but RN's networking layer
      // knows how to stream it from the file:// URI expo-image-picker returns.
      form.append("file", {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType,
      } as unknown as Blob);

      const res = await apiClient.post<{ success: boolean; message: string; data?: { icon_url: string } }>(
        "/wallets/icon",
        form,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return unwrap(res.data);
    },
  });
}
