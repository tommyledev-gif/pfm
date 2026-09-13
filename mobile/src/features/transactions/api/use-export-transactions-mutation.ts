import { useMutation } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

import { apiClient } from "@/lib/axios";
import { XLSX_MIME_TYPE, XLSX_UTI } from "@/lib/constants";

export interface ExportTransactionsParams {
  from: string;
  to: string;
  wallet_id?: string;
}

// GET /transactions/export (specs/transaction-export-import/spec.md US-01).
//
// The one endpoint in the app whose response is not the JSON envelope every
// other call returns — it's the .xlsx binary itself, so this deliberately
// skips `unwrap` and asks axios for an ArrayBuffer.
//
// There is no browser "download" on a phone: the bytes are written to the
// cache directory and handed to the platform share sheet, which is where
// "save to Files", "send to Drive", "email it to myself" all live. Cache, not
// documents — the file's only purpose is to be handed off, and letting the OS
// reclaim it afterwards is correct.
export function useExportTransactionsMutation() {
  return useMutation({
    mutationFn: async (params: ExportTransactionsParams) => {
      const res = await apiClient.get<ArrayBuffer>("/transactions/export", {
        params,
        responseType: "arraybuffer",
      });

      // Content-Disposition names the file the backend generated; fall back
      // to the same convention if a proxy ever strips the header.
      const filename = filenameFrom(res.headers?.["content-disposition"]) ?? `transactions_${params.from}_${params.to}.xlsx`;

      const file = new File(Paths.cache, filename);
      // A previous export of the same range would otherwise make create()
      // throw — overwriting is exactly what the user expects here.
      file.create({ overwrite: true });
      file.write(new Uint8Array(res.data));

      if (!(await Sharing.isAvailableAsync())) {
        throw new Error("Thiết bị này không hỗ trợ chia sẻ tệp.");
      }
      await Sharing.shareAsync(file.uri, {
        mimeType: XLSX_MIME_TYPE,
        UTI: XLSX_UTI,
        dialogTitle: "Xuất giao dịch",
      });
      return { filename };
    },
  });
}

// Pulls the filename out of `attachment; filename="transactions_a_b.xlsx"`.
// Returns null rather than throwing on anything unexpected — a missing or
// malformed header is not a reason to fail an export that already downloaded.
function filenameFrom(contentDisposition: unknown): string | null {
  if (typeof contentDisposition !== "string") return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(contentDisposition);
  return match?.[1] ?? null;
}
