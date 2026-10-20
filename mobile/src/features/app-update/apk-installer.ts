import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { File, Paths } from "expo-file-system";
// The legacy API: the new File.downloadFileAsync reports no progress, and an
// APK is ~50 MB.
import { createDownloadResumable } from "expo-file-system/legacy";

type IntentLauncher = typeof import("expo-intent-launcher");

const APK_MIME = "application/vnd.android.package-archive";
// Intent.FLAG_GRANT_READ_URI_PERMISSION: the system installer reads the file
// through expo-file-system's FileProvider, which grants nothing by default.
const FLAG_GRANT_READ_URI_PERMISSION = 1;
// One fixed name in the cache: a new download replaces the last one, and
// Android may clear the cache on its own once it is no longer needed.
const APK_FILE_NAME = "budgest-update.apk";

let cached: IntentLauncher | null | undefined;

// expo-intent-launcher, loaded on first use instead of at import: its entry
// resolves the native module eagerly (requireNativeModule), so a static
// import would crash a dev client built before the dependency was added.
// Same reason and shape as theme/view-shot.ts.
function loadIntentLauncher(): IntentLauncher | null {
  if (cached === undefined) {
    const hasNative = Platform.OS === "android" && requireOptionalNativeModule("ExpoIntentLauncher") != null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = hasNative ? (require("expo-intent-launcher") as IntentLauncher) : null;
  }
  return cached;
}

/** True when this binary can download and hand an APK to the installer itself. */
export function canInstallInApp(): boolean {
  return loadIntentLauncher() !== null;
}

/**
 * Downloads the APK at `url` into the app's cache, reporting progress as a
 * fraction (0..1; never called when the server sends no length). Resolves
 * with the file's uri. Rejects on a network failure or a non-200 answer.
 */
export async function downloadApk(url: string, onProgress: (fraction: number) => void): Promise<string> {
  const file = new File(Paths.cache, APK_FILE_NAME);
  if (file.exists) file.delete();
  const task = createDownloadResumable(url, file.uri, {}, ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
    if (totalBytesExpectedToWrite > 0) onProgress(Math.min(1, totalBytesWritten / totalBytesExpectedToWrite));
  });
  const result = await task.downloadAsync();
  if (result?.status !== 200) {
    if (file.exists) file.delete();
    throw new Error(`downloadApk: HTTP ${result?.status ?? "no response"}`);
  }
  return file.uri;
}

/**
 * Opens Android's own installer on the downloaded APK, as a sheet over the
 * app. Installing over an app always takes the User's tap there: no app can
 * install silently, and the first time Android also asks to allow installs
 * from Budgest. Resolves when the sheet is closed without installing; after
 * an install the process is replaced, so it never resolves.
 */
export async function openApkInstaller(fileUri: string): Promise<void> {
  const launcher = loadIntentLauncher();
  if (!launcher) throw new Error("openApkInstaller: no intent launcher in this build");
  await launcher.startActivityAsync("android.intent.action.VIEW", {
    data: new File(fileUri).contentUri,
    type: APK_MIME,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}
