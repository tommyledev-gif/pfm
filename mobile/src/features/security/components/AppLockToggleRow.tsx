import { useState } from "react";
import { Text, View } from "react-native";

import { Toggle } from "@/components/ui/Toggle";
import { createStyles, radii, spacing, typography } from "@/lib/theme";
import { useSecurityPrefsStore } from "@/stores/security-prefs-store";
import { useToastStore } from "@/stores/toast-store";
import { CHANGE_SETTING_PROMPT, confirmOwner } from "@/features/security/identity-check";

const TITLE = "Khóa ứng dụng";
const HINT = "Hỏi vân tay, khuôn mặt hoặc mã khóa màn hình khi mở ứng dụng.";
const NO_LOCK = "Máy chưa cài khóa màn hình nên chưa bật được khóa ứng dụng.";
const FAILED = "Không xác minh được.";

/**
 * The device-wide app lock switch (US-12, default off). Both directions ask
 * for the owner check first: turning it on proves the check works on this
 * phone, turning it off must not be possible for whoever just picked the
 * phone up. A phone with no screen lock cannot turn it on; it can always turn
 * it off.
 */
export function AppLockToggleRow() {
  const styles = useStyles();
  const enabled = useSecurityPrefsStore((s) => s.appLockEnabled);
  const setEnabled = useSecurityPrefsStore((s) => s.setAppLockEnabled);
  const [checking, setChecking] = useState(false);

  const onChange = async (next: boolean) => {
    setChecking(true);
    try {
      const result = await confirmOwner(CHANGE_SETTING_PROMPT);
      if (result === "passed") setEnabled(next);
      else if (result === "unavailable") {
        if (next) useToastStore.getState().show(NO_LOCK, "warning");
        else setEnabled(false);
      } else if (result === "failed") useToastStore.getState().show(FAILED, "warning");
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>{TITLE}</Text>
        <Text style={styles.hint}>{HINT}</Text>
      </View>
      <Toggle
        value={enabled}
        onValueChange={onChange}
        disabled={checking}
        accessibilityLabel={TITLE}
        testID="switch-app-lock"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  text: { flex: 1, gap: spacing.xs },
  title: { ...typography.body, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textSecondary },
}));
