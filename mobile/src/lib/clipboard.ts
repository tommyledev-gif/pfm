import * as Clipboard from "expo-clipboard";

import { useToastStore } from "@/stores/toast-store";

const COPIED_MESSAGE = "Đã sao chép";
const COPY_FAILED_MESSAGE = "Không sao chép được";

// Copies text and says so. Never logs the text — it may be a financial record.
export async function copyToClipboard(text: string): Promise<void> {
  const toast = useToastStore.getState();
  try {
    await Clipboard.setStringAsync(text);
    toast.show(COPIED_MESSAGE, "info");
  } catch {
    toast.show(COPY_FAILED_MESSAGE, "error");
  }
}
