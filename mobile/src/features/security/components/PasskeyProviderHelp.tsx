import { useEffect, useRef } from "react";
import { AppState, Pressable, Text, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { CloseIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { choosesPasskeyProvider, openPasskeySettings } from "@/features/security/passkeys/passkey-settings";

interface PasskeyProviderHelpProps {
  onRetry: () => void;
  retrying?: boolean;
  onDismiss: () => void;
  /** The automatic retry after Settings failed the same way again. */
  stillMissing?: boolean;
}

// Android 14+: the phone keeps passkeys in whichever password services are
// switched on under "Mật khẩu, khóa truy cập và tài khoản". Credential
// Manager's NoCreateOption only says no service took the request: none is on,
// OR the one that is on refused Budgest (its check of the server's
// assetlinks.json, cached on the phone for up to an hour). So the copy states
// what failed and offers the usual fix, never that the settings are off.
const PROVIDER_COPY = {
  title: "Máy chưa lưu được passkey",
  why: "Passkey nằm trong trình quản lý mật khẩu của máy, thường là Google.",
  steps: ["Bấm Mở Cài đặt.", "Kiểm tra Google đang bật trong danh sách dịch vụ."],
  open: "Mở Cài đặt",
  notFound: "Không thấy danh sách: tìm “khóa truy cập” trong Cài đặt.",
  stillMissing: "Vẫn chưa lưu được passkey. Google đã bật thì thử lại sau.",
} as const;

// Before Android 14: passkeys always go to Google, which needs an account.
const ACCOUNT_COPY = {
  title: "Máy chưa có tài khoản Google",
  why: "Passkey được lưu vào tài khoản Google trên máy.",
  steps: ["Bấm Thêm tài khoản Google.", "Đăng nhập một tài khoản Google."],
  open: "Thêm tài khoản Google",
  notFound: null,
  stillMissing: "Máy vẫn chưa có tài khoản Google. Thêm tài khoản rồi quay lại.",
} as const;

const RETURN_STEP = "Quay lại đây, passkey tự thêm tiếp.";
const RETRY_LABEL = "Thử lại";

/**
 * What to do when the phone has nowhere to keep a passkey (Credential
 * Manager's NoCreateOption / NotConfigured). No app may pick or switch on a
 * password service for the User: Android keeps that choice in Settings. So
 * this opens the exact screen and, the moment the User comes back from it,
 * runs the passkey step again on its own; "Thử lại" stays for a phone where
 * that return is missed.
 */
export function PasskeyProviderHelp({ onRetry, retrying, onDismiss, stillMissing }: PasskeyProviderHelpProps) {
  const colors = useColors();
  const styles = useStyles();
  const copy = choosesPasskeyProvider() ? PROVIDER_COPY : ACCOUNT_COPY;
  const steps = [...copy.steps, RETURN_STEP];

  // Set when Settings is opened from here; the next return to the app spends it.
  const awaitingReturn = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !awaitingReturn.current) return;
      awaitingReturn.current = false;
      onRetry();
    });
    return () => subscription.remove();
  }, [onRetry]);

  const openSettings = () => {
    awaitingReturn.current = true;
    void openPasskeySettings();
  };

  return (
    <View style={styles.card} testID="card-passkey-provider-help">
      <View style={styles.header}>
        <Text style={styles.title}>{copy.title}</Text>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Đóng hướng dẫn">
          <CloseIcon size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
      <Text style={styles.why}>{copy.why}</Text>

      {steps.map((step, index) => (
        <View key={step} style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberLabel}>{index + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
      {copy.notFound ? <Text style={styles.note}>{copy.notFound}</Text> : null}
      {stillMissing ? (
        <Text style={styles.stillMissing} testID="text-passkey-still-missing">
          {copy.stillMissing}
        </Text>
      ) : null}

      <View style={styles.actions}>
        <PillButton label={copy.open} onPress={openSettings} style={styles.action} testID="btn-passkey-open-settings" />
        <PillButton
          label={RETRY_LABEL}
          variant="outline"
          onPress={onRetry}
          loading={retrying}
          style={styles.action}
          testID="btn-passkey-retry"
        />
      </View>
    </View>
  );
}

const STEP_NUMBER_SIZE = 20;

const useStyles = createStyles((colors) => ({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: withAlpha(colors.mustard, 0.4),
    backgroundColor: withAlpha(colors.mustard, 0.08),
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  title: { flex: 1, ...typography.body, fontWeight: "700", color: colors.textPrimary },
  why: { ...typography.caption, color: colors.textSecondary },
  step: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  stepNumber: {
    width: STEP_NUMBER_SIZE,
    height: STEP_NUMBER_SIZE,
    borderRadius: STEP_NUMBER_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.mustard, 0.25),
  },
  stepNumberLabel: { ...typography.tiny, fontWeight: "700", color: colors.textPrimary },
  stepText: { flex: 1, ...typography.caption, color: colors.textPrimary },
  note: { ...typography.tiny, color: colors.textSecondary },
  stillMissing: { ...typography.caption, fontWeight: "600", color: colors.peach },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1 },
}));
