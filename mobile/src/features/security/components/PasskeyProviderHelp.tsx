import { Pressable, Text, View } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { CloseIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { choosesPasskeyProvider, openPasskeySettings } from "@/features/security/passkeys/passkey-settings";

interface PasskeyProviderHelpProps {
  onRetry: () => void;
  retrying?: boolean;
  onDismiss: () => void;
}

// Android 14+: the phone has to have a passkey service chosen (Google).
const PROVIDER_COPY = {
  title: "Máy chưa chọn nơi lưu passkey",
  steps: ["Bấm Mở cài đặt bên dưới.", "Chọn Google trong danh sách dịch vụ mật khẩu và khóa truy cập."],
  open: "Mở cài đặt",
  notFound: "Không thấy danh sách đó: tìm “khóa truy cập” trong Cài đặt.",
} as const;

// Before Android 14: passkeys always go to Google, which needs an account.
const ACCOUNT_COPY = {
  title: "Máy chưa có tài khoản Google",
  steps: ["Bấm Thêm tài khoản Google bên dưới.", "Đăng nhập một tài khoản Google."],
  open: "Thêm tài khoản Google",
  notFound: null,
} as const;

/**
 * What to do when the phone has nowhere to keep a passkey (Credential
 * Manager's NoCreateOption): the steps, a button straight to the screen that
 * fixes it, and a retry for when the User comes back. Shown in place of a
 * one-line toast, which said what was wrong but left the User to find the
 * setting alone.
 */
export function PasskeyProviderHelp({ onRetry, retrying, onDismiss }: PasskeyProviderHelpProps) {
  const colors = useColors();
  const styles = useStyles();
  const copy = choosesPasskeyProvider() ? PROVIDER_COPY : ACCOUNT_COPY;
  const steps = [...copy.steps, RETURN_STEP];

  return (
    <View style={styles.card} testID="card-passkey-provider-help">
      <View style={styles.header}>
        <Text style={styles.title}>{copy.title}</Text>
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Đóng hướng dẫn">
          <CloseIcon size={16} color={colors.textSecondary} />
        </Pressable>
      </View>

      {steps.map((step, index) => (
        <View key={step} style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberLabel}>{index + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
      {copy.notFound ? <Text style={styles.note}>{copy.notFound}</Text> : null}

      <View style={styles.actions}>
        <PillButton
          label={copy.open}
          onPress={() => void openPasskeySettings()}
          style={styles.action}
          testID="btn-passkey-open-settings"
        />
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
const RETRY_LABEL = "Thử lại";
const RETURN_STEP = `Quay lại đây, bấm ${RETRY_LABEL}.`;

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
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1 },
}));
