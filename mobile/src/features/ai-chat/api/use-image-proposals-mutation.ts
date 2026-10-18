import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { CAPTURE_MIME_TYPE } from "@/features/ai-chat/image-capture";
import { ImageProposalsResponse } from "@/features/ai-chat/types";

// One reading may take a provider call plus one retry on the server
// (2 × 12 s); the global 15 s axios timeout is too short (plan F40).
const IMAGE_REQUEST_TIMEOUT_MS = 35_000;
const CAPTURE_FILE_NAME = "capture.jpg";

interface ImageProposalsRequest {
  uri: string;
  caption?: string;
}

/** POST /transactions/image-proposals — reads one photo, saves nothing. */
export function useImageProposalsMutation() {
  return useMutation({
    mutationFn: async ({ uri, caption }: ImageProposalsRequest) => {
      const form = new FormData();
      // React Native's FormData streams this {uri, name, type} shape from the
      // file:// URI — same precedent as the icon uploads.
      form.append("image", { uri, name: CAPTURE_FILE_NAME, type: CAPTURE_MIME_TYPE } as unknown as Blob);
      if (caption) form.append("caption", caption);
      const res = await apiClient.post<{ success: boolean; message: string; data?: ImageProposalsResponse }>(
        "/transactions/image-proposals",
        form,
        { headers: { "Content-Type": "multipart/form-data" }, timeout: IMAGE_REQUEST_TIMEOUT_MS },
      );
      return unwrap(res.data);
    },
  });
}
