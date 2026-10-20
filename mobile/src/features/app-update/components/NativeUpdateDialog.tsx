import { Linking, Modal, Text, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { Config } from "@/lib/config";
import { withAlpha } from "@/lib/color";
import { formatPercent } from "@/lib/percent";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { useNativeUpdateQuery } from "@/features/app-update/api/use-native-update-query";
import { canInstallInApp } from "@/features/app-update/apk-installer";
import { useApkUpdate } from "@/features/app-update/hooks/use-apk-update";

const COPY = {
  title: "Cần cài bản Budgest mới",
  message: "Bản đang dùng đã cũ nên không nhận thêm cập nhật. Cài bản mới đè lên, dữ liệu và đăng nhập vẫn giữ nguyên.",
  hint: "Tải xong, chọn Cài đặt khi máy hỏi.",
  // The installer sheet was closed: most often Android first asking to
  // allow installs from Budgest.
  readyHint: "Máy hỏi quyền cài ứng dụng thì bật cho Budgest.",
  browserHint: "Tải xong, mở file vừa tải và chọn Cài đặt.",
  download: "Tải bản mới",
  install: "Cài bản mới",
  retry: "Tải lại",
  browser: "Tải bằng trình duyệt",
  downloadFailed: "Chưa tải được bản mới. Kiểm tra mạng rồi thử lại.",
  installFailed: "Chưa mở được trình cài đặt.",
} as const;

const downloadingLabel = (progress: number | null) =>
  progress === null ? "Đang tải" : `Đang tải ${formatPercent(progress * 100)}`;

// Served by the backend (AppUpdateHandler.DownloadAPK): always the newest APK.
const APK_URL = `${Config.apiBaseUrl}/app-updates/apk`;

const openInBrowser = () => void Linking.openURL(APK_URL);

/**
 * Blocks the app when its APK is too old for the updates being published
 * (useNativeUpdateQuery). No way to dismiss: this app version would never
 * change again, so carrying on in it only hides the problem. Mounted once,
 * in the root layout, above every screen.
 *
 * The APK downloads inside the app and opens in Android's installer, a
 * sheet over the app; the User only taps Cài đặt there (Android never lets
 * an app install itself without that tap). Installing restarts the app on
 * the new APK, which no longer asks. A build without the intent launcher, or
 * an installer that will not open, falls back to the browser download.
 */
export function NativeUpdateDialog() {
  const status = useNativeUpdateQuery();
  if (!status.data?.update_required) return null;
  return <NativeUpdateCard />;
}

function NativeUpdateCard() {
  const styles = useStyles();
  const { state, download, install } = useApkUpdate(APK_URL);
  const inApp = canInstallInApp();
  const installBroken = state.phase === "failed" && state.step === "install";

  let hint: string = COPY.hint;
  if (!inApp || installBroken) hint = COPY.browserHint;
  else if (state.phase === "ready") hint = COPY.readyHint;

  const renderAction = () => {
    if (!inApp || installBroken) {
      return <PillButton label={COPY.download} onPress={openInBrowser} testID="btn-native-update-download" />;
    }
    switch (state.phase) {
      case "downloading":
        // Full primary color, not the dimmed disabled look: the download is
        // running, nothing is wrong. The hook ignores taps meanwhile.
        return (
          <View style={styles.progressGroup} accessibilityRole="progressbar" accessibilityValue={progressValue(state.progress)}>
            <PillButton label={downloadingLabel(state.progress)} testID="btn-native-update-downloading" />
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((state.progress ?? 0) * 100)}%` }]} />
            </View>
          </View>
        );
      case "ready":
        return <PillButton label={COPY.install} onPress={() => void install(state.fileUri)} testID="btn-native-update-install" />;
      case "failed":
        return (
          <>
            <PillButton label={COPY.retry} onPress={() => void download()} testID="btn-native-update-retry" />
            <PillButton label={COPY.browser} variant="outline" onPress={openInBrowser} testID="btn-native-update-browser" />
          </>
        );
      default:
        return <PillButton label={COPY.download} onPress={() => void download()} testID="btn-native-update-download" />;
    }
  };

  return (
    // onRequestClose does nothing: Android's back button must not close it.
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="dialog-native-update">
          <Text style={styles.title}>{COPY.title}</Text>
          <Text style={styles.message}>{COPY.message}</Text>
          {state.phase === "failed" ? (
            <Text style={styles.error} testID="text-native-update-error">
              {state.step === "download" ? COPY.downloadFailed : COPY.installFailed}
            </Text>
          ) : null}
          <Text style={styles.hint}>{hint}</Text>
          <View style={styles.actions}>{renderAction()}</View>
        </View>
      </View>
    </Modal>
  );
}

function progressValue(progress: number | null) {
  return progress === null ? undefined : { min: 0, max: 100, now: Math.round(progress * 100) };
}

const useStyles = createStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.title, color: colors.textPrimary },
  message: { ...typography.body, color: colors.textSecondary },
  error: { ...typography.label, color: colors.error },
  hint: { ...typography.caption, color: colors.textSecondary },
  actions: { marginTop: spacing.sm, gap: spacing.sm },
  progressGroup: { gap: spacing.sm },
  track: { height: 4, borderRadius: radii.pill, backgroundColor: withAlpha(colors.green, 0.2), overflow: "hidden" },
  fill: { height: "100%", borderRadius: radii.pill, backgroundColor: colors.green },
}));
