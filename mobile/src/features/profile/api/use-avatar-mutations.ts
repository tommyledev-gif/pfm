import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { applyProfile } from "@/features/profile/api/apply-profile";
import { User } from "@/features/users/types";

export interface AvatarAsset {
  uri: string;
  name: string;
  mimeType: string;
}

// POST /users/me/avatar — same multipart shape as the wallet and category icon
// uploads. The server checks the file's own bytes (PNG, JPEG or WebP), scales
// it down, strips its metadata and replaces the previous picture.
export function useUploadAvatarMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (asset: AvatarAsset) => {
      const form = new FormData();
      // React Native's FormData takes this {uri, name, type} shape directly;
      // it streams the file:// URI expo-image-picker returns.
      form.append("file", { uri: asset.uri, name: asset.name, type: asset.mimeType } as unknown as Blob);
      const res = await apiClient.post<ApiEnvelope<User>>("/users/me/avatar", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return unwrap(res.data);
    },
    onSuccess: (user) => applyProfile(queryClient, user),
  });
}

// DELETE /users/me/avatar — back to the initial. Safe to repeat.
export function useRemoveAvatarMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap((await apiClient.delete<ApiEnvelope<User>>("/users/me/avatar")).data),
    onSuccess: (user) => applyProfile(queryClient, user),
  });
}
