import { useEffect } from "react";
import { Linking, Modal, Text, View } from "react-native";

import { DownloadIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { Config } from "@/lib/config";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useNativeUpdateQuery } from "@/features/app-update/api/use-native-update-query";
import { canInstallInApp } from "@/features/app-update/apk-installer";
import { FadeIn, PopIn, SmoothHeight } from "@/features/app-update/components/update-motion";
import { UpdateProgress } from "@/features/app-update/components/UpdateProgress";
import { ApkUpdateState, useApkUpdate } from "@/features/app-update/hooks/use-apk-update";

const COPY = {
  title: "Cần cài bản Budgest mới",
  message: "Bản đang dùng đã cũ nên không nhận thêm cập nhật. Cài bản mới đè lên, dữ liệu và đăng nhập vẫn giữ nguyên.",
  version: (name: string) => `Bản ${name}`,
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

const ACTION_HEIGHT = 52;

// Served by the backend (AppUpdateHandler.DownloadAPK): always the newest APK.
// The in-app download uses the API address, which nobody sees; a browser is
// handed the public link when the server has one (download_url), so the API's
// host never shows in front of a person.
const APK_URL = `${Config.apiBaseUrl}/app-updates/apk`;

// What the card body shows. In-app, idle lasts only until the effect below
// starts the download, so it already reads as progress: no "Tải bản mới"
// button flashing up for a frame before the bar replaces it.
type Stage = "progress" | "install" | "failed" | "browser";

function stageOf(state: ApkUpdateState, inApp: boolean): Stage {
  if (!inApp || (state.phase === "failed" && state.step === "install")) return "browser";
  if (state.phase === "ready") return "install";
  if (state.phase === "failed") return "failed";
  return "progress";
}

/**
 * Blocks the app when its APK is too old for the updates being published
 * (useNativeUpdateQuery). No way to dismiss: this app version would never
 * change again, so carrying on in it only hides the problem. Mounted once,
 * in the root layout, above every screen.
 *
 * The APK starts downloading inside the app the moment the dialog appears,
 * with no tap, and opens in Android's installer, a sheet over the app, once
 * it is in; the User only taps Cài đặt there (Android never lets a sideloaded
 * app install itself without that tap). Installing restarts the app on
 * the new APK, which no longer asks. A build without the intent launcher, or
 * an installer that will not open, falls back to the browser download.
 */
export function NativeUpdateDialog() {
  const status = useNativeUpdateQuery();
  if (!status.data?.update_required) return null;
  return <NativeUpdateCard versionName={status.data.version_name} browserUrl={status.data.download_url || APK_URL} />;
}

function NativeUpdateCard({ versionName, browserUrl }: { versionName: string; browserUrl: string }) {
  const openInBrowser = () => void Linking.openURL(browserUrl);
  const colors = useColors();
  const styles = useStyles();
  const { state, download, install } = useApkUpdate(APK_URL);
  const inApp = canInstallInApp();
  const stage = stageOf(state, inApp);

  // No tap to start: the app is blocked until the new APK is in, so there is
  // nothing to ask. Once per dialog (download is stable); after a failure
  // it waits for Tải lại instead of retrying on its own.
  useEffect(() => {
    if (inApp) void download();
  }, [inApp, download]);

  const renderStage = () => {
    switch (stage) {
      case "progress":
        return (
          <>
            <UpdateProgress progress={state.phase === "downloading" ? state.progress : null} />
            <Text style={styles.hint}>{COPY.hint}</Text>
          </>
        );
      case "install":
        return (
          <>
            <PillButton
              label={COPY.install}
              onPress={() => {
                if (state.phase === "ready") void install(state.fileUri);
              }}
              style={styles.action}
              testID="btn-native-update-install"
            />
            <Text style={styles.hint}>{COPY.readyHint}</Text>
          </>
        );
      case "failed":
        return (
          <>
            <ErrorNote message={COPY.downloadFailed} />
            <PillButton label={COPY.retry} onPress={() => void download()} style={styles.action} testID="btn-native-update-retry" />
            <PillButton
              label={COPY.browser}
              variant="outline"
              onPress={openInBrowser}
              style={styles.action}
              testID="btn-native-update-browser"
            />
          </>
        );
      case "browser":
        return (
          <>
            {state.phase === "failed" ? <ErrorNote message={COPY.installFailed} /> : null}
            <PillButton
              label={COPY.download}
              icon={<DownloadIcon size={18} color={colors.onGreen} />}
              onPress={openInBrowser}
              style={styles.action}
              testID="btn-native-update-download"
            />
            <Text style={styles.hint}>{COPY.browserHint}</Text>
          </>
        );
    }
  };

  return (
    // onRequestClose does nothing: Android's back button must not close it.
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <PopIn style={styles.card} testID="dialog-native-update">
          <View style={styles.heading}>
            <View style={styles.badge}>
              <DownloadIcon size={24} color={colors.green} />
            </View>
            {versionName ? (
              <View style={styles.version}>
                <Text style={styles.versionText}>{COPY.version(versionName)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.title}>{COPY.title}</Text>
          <Text style={styles.message}>{COPY.message}</Text>
          <SmoothHeight>
            <FadeIn key={stage} style={styles.body}>
              {renderStage()}
            </FadeIn>
          </SmoothHeight>
        </PopIn>
      </View>
    </Modal>
  );
}

function ErrorNote({ message }: { message: string }) {
  const styles = useStyles();
  return (
    <View style={styles.errorBox}>
      <Text style={styles.error} testID="text-native-update-error">
        {message}
      </Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.hero,
    padding: spacing.xxl,
    gap: spacing.md,
  },
  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  badge: {
    width: 52,
    height: 52,
    borderRadius: radii.listCard,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.green, 0.14),
  },
  version: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  versionText: { ...typography.caption, color: colors.textSecondary },
  title: { ...typography.title, color: colors.textPrimary },
  message: { ...typography.body, fontWeight: "500", lineHeight: 22, color: colors.textSecondary },
  // Room above the stage: the message ends, then what to do about it.
  body: { gap: spacing.sm, paddingTop: spacing.sm },
  action: { height: ACTION_HEIGHT },
  hint: { ...typography.caption, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xs },
  errorBox: {
    backgroundColor: withAlpha(colors.peach, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.peach, 0.35),
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  error: { ...typography.label, color: colors.peach },
}));
