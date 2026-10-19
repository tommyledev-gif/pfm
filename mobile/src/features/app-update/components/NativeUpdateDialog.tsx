import { Linking, Modal, Text, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { Config } from "@/lib/config";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { useNativeUpdateQuery } from "@/features/app-update/api/use-native-update-query";

const COPY = {
  title: "Cần cài bản Budgest mới",
  message: "Bản đang dùng đã cũ nên không nhận thêm cập nhật. Cài bản mới đè lên, dữ liệu và đăng nhập vẫn giữ nguyên.",
  hint: "Tải xong, mở file vừa tải và chọn Cài đặt.",
  download: "Tải bản mới",
} as const;

// Served by the backend (AppUpdateHandler.DownloadAPK): always the newest APK.
const APK_URL = `${Config.apiBaseUrl}/app-updates/apk`;

/**
 * Blocks the app when its APK is too old for the updates being published
 * (useNativeUpdateQuery): one button, out to the browser, which downloads
 * the newest APK for the User to install over this one. No way to dismiss:
 * this app version would never change again, so carrying on in it only
 * hides the problem. Installing restarts the app on the new APK, which no
 * longer asks. Mounted once, in the root layout, above every screen.
 */
export function NativeUpdateDialog() {
  const styles = useStyles();
  const status = useNativeUpdateQuery();
  if (!status.data?.update_required) return null;

  return (
    // onRequestClose does nothing: Android's back button must not close it.
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="dialog-native-update">
          <Text style={styles.title}>{COPY.title}</Text>
          <Text style={styles.message}>{COPY.message}</Text>
          <Text style={styles.hint}>{COPY.hint}</Text>
          <PillButton
            label={COPY.download}
            onPress={() => void Linking.openURL(APK_URL)}
            style={styles.action}
            testID="btn-native-update-download"
          />
        </View>
      </View>
    </Modal>
  );
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
  hint: { ...typography.caption, color: colors.textSecondary },
  action: { marginTop: spacing.sm },
}));
