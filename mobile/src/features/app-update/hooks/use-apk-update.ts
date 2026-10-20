import { useCallback, useRef, useState } from "react";

import { downloadApk, openApkInstaller } from "@/features/app-update/apk-installer";

// idle → downloading → (installer sheet) → ready when it was closed without
// installing. An install replaces the process, so nothing comes after it.
// failed says which step broke: a download can be retried, an installer that
// would not open can only be worked around through the browser.
export type ApkUpdateState =
  | { phase: "idle" }
  | { phase: "downloading"; progress: number | null }
  | { phase: "ready"; fileUri: string }
  | { phase: "failed"; step: "download" | "install" };

/**
 * Downloads the newest APK inside the app and hands it to Android's
 * installer, so updating never sends the User out to the browser. Local UI
 * state only: the file and its progress are not server data.
 */
export function useApkUpdate(url: string) {
  const [state, setState] = useState<ApkUpdateState>({ phase: "idle" });
  const busy = useRef(false);

  const runInstaller = useCallback(async (fileUri: string) => {
    try {
      await openApkInstaller(fileUri);
      // Closed without installing: keep the file, offer the sheet again.
      setState({ phase: "ready", fileUri });
    } catch {
      setState({ phase: "failed", step: "install" });
    }
  }, []);

  // A second tap while the sheet is opening would stack a second sheet.
  const install = useCallback(
    async (fileUri: string) => {
      if (busy.current) return;
      busy.current = true;
      await runInstaller(fileUri);
      busy.current = false;
    },
    [runInstaller],
  );

  const download = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState({ phase: "downloading", progress: null });
    // Progress arrives per network chunk; re-rendering only when the shown
    // whole percent changes keeps a 50 MB download from flooding the JS thread.
    let shownPercent = -1;
    try {
      const fileUri = await downloadApk(url, (fraction) => {
        const percent = Math.floor(fraction * 100);
        if (percent === shownPercent) return;
        shownPercent = percent;
        setState({ phase: "downloading", progress: fraction });
      });
      await runInstaller(fileUri);
    } catch {
      setState({ phase: "failed", step: "download" });
    } finally {
      busy.current = false;
    }
  }, [url, runInstaller]);

  return { state, download, install };
}
