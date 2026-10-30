import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FingerprintIcon } from "@/components/ui/Icon";
import { createStyles, spacing, typography, useColors } from "@/lib/theme";
import { PIN_COPY } from "@/features/security/pin/pin-copy";

interface PinAltActionsProps {
  /** The phone's own check, named for it ("Dùng vân tay"); null hides it. */
  phoneCheckLabel: string | null;
  onPhoneCheck: () => void;
  /** Shown with "Quên mã PIN?"; called once the wipe is confirmed (BR-07). */
  onForgotConfirmed?: () => void;
  /** Work in progress (checking, signing out): a spinner, nothing to tap. */
  busy?: boolean;
}

// Under a PIN keypad: the other way in, and the way out for a forgotten PIN.
// The wipe asks first, naming what is lost; "Giữ lại" keeps everything.
export function PinAltActions({ phoneCheckLabel, onPhoneCheck, onForgotConfirmed, busy = false }: PinAltActionsProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const [confirming, setConfirming] = useState(false);

  if (busy) {
    return (
      <View style={styles.actions}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  return (
    <View style={styles.actions}>
      {phoneCheckLabel ? (
        <Pressable
          onPress={onPhoneCheck}
          hitSlop={8}
          style={styles.phoneCheck}
          accessibilityRole="button"
          testID="btn-pin-biometric"
        >
          <FingerprintIcon size={20} color={colors.green} strokeWidth={2} />
          <Text style={styles.link}>{phoneCheckLabel}</Text>
        </Pressable>
      ) : null}
      {onForgotConfirmed ? (
        <Pressable onPress={() => setConfirming(true)} hitSlop={8} accessibilityRole="button" testID="btn-pin-forgot">
          <Text style={styles.forgot}>{t(PIN_COPY.forgot)}</Text>
        </Pressable>
      ) : null}
      <ConfirmDialog
        visible={confirming}
        title={t(PIN_COPY.forgot)}
        message={t(PIN_COPY.forgotMessage)}
        confirmLabel={t(PIN_COPY.forgotConfirm)}
        cancelLabel={t(PIN_COPY.forgotKeep)}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onForgotConfirmed?.();
        }}
        testID="dialog-pin-forgot"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  actions: { minHeight: 64, alignItems: "center", justifyContent: "center", gap: spacing.md },
  phoneCheck: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 4 },
  link: { ...typography.body, color: colors.green },
  forgot: { ...typography.label, color: colors.textSecondary },
}));
