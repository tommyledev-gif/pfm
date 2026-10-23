import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { ImportPreview } from "@/features/transactions/types";

// A 5 MiB workbook over mobile data can take longer than the client's default
// 15 s to upload; the server's own work is under a second.
const IMPORT_PREVIEW_TIMEOUT_MS = 60_000;

export interface ImportFileAsset {
  uri: string;
  name: string;
  mimeType: string;
}

// POST /transactions/import/preview (specs/transaction-export-import/spec.md
// US-02) — a dry run: the server parses and validates the file and writes
// nothing. The `import_token` it returns is what Commit consumes; the file
// itself is never re-uploaded.
//
// Multipart body built the same way as the icon uploaders
// (use-upload-wallet-icon-mutation.ts): React Native's FormData takes the
// {uri, name, type} shape directly and streams it from the file:// URI
// expo-document-picker hands back.
export function useImportPreviewMutation() {
  return useMutation({
    mutationFn: async (asset: ImportFileAsset) => {
      const form = new FormData();
      form.append("file", {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType,
      } as unknown as Blob);

      const res = await apiClient.post<{ success: boolean; message: string; data?: ImportPreview }>(
        "/transactions/import/preview",
        form,
        { headers: { "Content-Type": "multipart/form-data" }, timeout: IMPORT_PREVIEW_TIMEOUT_MS },
      );
      return unwrap(res.data);
    },
  });
}
