import { useState } from "react";

import { getErrorMessage } from "@/lib/axios";
import { useRequireOnline } from "@/lib/connectivity";
import { IMPORT_MAX_UPLOAD_BYTES, XLSX_MIME_TYPE } from "@/lib/constants";
import { useToastStore } from "@/stores/toast-store";
import { useExportTransactionsMutation } from "@/features/transactions/api/use-export-transactions-mutation";
import { useImportCommitMutation } from "@/features/transactions/api/use-import-commit-mutation";
import { useImportPreviewMutation } from "@/features/transactions/api/use-import-preview-mutation";
import { ImportPreviewModal } from "@/features/transactions/components/ImportPreviewModal";
import { ImportPreview, ImportResult } from "@/features/transactions/types";

export interface TransactionIOProps {
  // Whatever range the Transactions screen currently shows — export reuses
  // the user's own filters rather than being a separate unfiltered dump
  // (specs/transaction-export-import/spec.md US-01 step 1).
  range: { from: string; to: string };
  walletId?: string;
  currency: string;
}

// Owns the whole export/import flow for the Transactions screen — the file
// picker, the three mutations, and the preview sheet — so the screen itself
// only has to render two buttons and hand over the current filter.
//
// A hook rather than a component: the buttons belong inside
// TransactionsHeader's existing filter row (no new vertical space), while the
// modal has to render as a sibling of the list, not inside its header. Those
// two can't be one component, but they must share one piece of state.
export function useTransactionIO({ range, walletId, currency }: TransactionIOProps) {
  const requireOnline = useRequireOnline();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const exportMutation = useExportTransactionsMutation();
  const previewMutation = useImportPreviewMutation();
  const commitMutation = useImportCommitMutation();

  const onExport = () => {
    exportMutation.mutate(
      { from: range.from, to: range.to, wallet_id: walletId },
      {
        onError: (error) =>
          useToastStore.getState().show(getErrorMessage(error, "Không xuất được tệp"), "error"),
      },
    );
  };

  const onImport = async () => {
    // Imported lazily: expo-document-picker pulls in a native module, and
    // this screen mounts on every app start while the picker is opened
    // rarely.
    const DocumentPicker = await import("expo-document-picker");
    const picked = await DocumentPicker.getDocumentAsync({
      // Both are needed: Android matches on the MIME type, iOS on the
      // extension its own picker reports back.
      type: [XLSX_MIME_TYPE, "application/octet-stream"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    const asset = picked.assets[0];
    if (!asset.name.toLowerCase().endsWith(".xlsx")) {
      useToastStore.getState().show("Chỉ hỗ trợ tệp .xlsx", "error");
      return;
    }
    // Checked here as well as server-side so a 20MB file fails instantly
    // instead of after uploading it over mobile data.
    if (asset.size !== undefined && asset.size > IMPORT_MAX_UPLOAD_BYTES) {
      useToastStore.getState().show("Tệp vượt quá giới hạn 5MB", "error");
      return;
    }

    previewMutation.mutate(
      { uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? XLSX_MIME_TYPE },
      {
        onSuccess: (data) => {
          setPreview(data);
          setResult(null);
          setModalOpen(true);
        },
        onError: (error) =>
          useToastStore.getState().show(getErrorMessage(error, "Không đọc được tệp"), "error"),
      },
    );
  };

  const onConfirm = () => {
    if (!preview) return;
    commitMutation.mutate(preview.import_token, {
      onSuccess: setResult,
      onError: (error) => {
        // The token is 5 minutes old at most, but a slow review can still
        // outlive it — say so plainly rather than showing a bare 401.
        useToastStore
          .getState()
          .show(getErrorMessage(error, "Phiên nhập đã hết hạn — chọn lại tệp giúp mình nhé"), "error");
        setModalOpen(false);
      },
    });
  };

  const closeModal = () => {
    setModalOpen(false);
    setPreview(null);
    setResult(null);
  };

  return {
    // Export and import both need the server; checked before the file
    // picker opens so the User is not walked through it for nothing.
    onExport: () => requireOnline(onExport),
    onImport: () => requireOnline(onImport),
    exporting: exportMutation.isPending,
    importing: previewMutation.isPending,
    modal: (
      <ImportPreviewModal
        visible={modalOpen}
        preview={preview}
        result={result}
        committing={commitMutation.isPending}
        currency={currency}
        onConfirm={() => requireOnline(onConfirm)}
        onClose={closeModal}
      />
    ),
  };
}
