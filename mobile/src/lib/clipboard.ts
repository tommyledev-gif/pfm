import * as Clipboard from "expo-clipboard";

import { i18n, TranslationKey } from "@/lib/i18n";
import { useToastStore } from "@/stores/toast-store";

const COPIED_MESSAGE = "ui.clipboard.copied" satisfies TranslationKey;
const COPY_FAILED_MESSAGE = "ui.clipboard.copyFailed" satisfies TranslationKey;

// Copies text and says so. Never logs the text — it may be a financial record.
export async function copyToClipboard(text: string): Promise<void> {
  const toast = useToastStore.getState();
  try {
    await Clipboard.setStringAsync(text);
    toast.show(i18n.t(COPIED_MESSAGE), "info");
  } catch {
    toast.show(i18n.t(COPY_FAILED_MESSAGE), "error");
  }
}
