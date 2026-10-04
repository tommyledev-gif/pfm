import { useState } from "react";
import { Text, View } from "react-native";

import { Toggle } from "@/components/ui/Toggle";
import { createStyles, radii, spacing, typography } from "@/lib/theme";
import { useSecurityPrefsStore } from "@/stores/security-prefs-store";
import { confirmOwner } from "@/features/security/identity-check";

const TITLE = "Xác minh khi chuyển tài khoản";
const HINT = "Yêu cầu vân tay, khuôn mặt hoặc mã khóa màn hình trước khi chuyển sang tài khoản đã lưu.";

/**
 * The device-wide identity-check switch (spec US-07). Turning it OFF first
 * asks for the check itself (AC-32) — otherwise whoever holds an unlocked
 * phone could simply switch it off; cancelled or failed keeps it on. A phone
 * with no lock at all lets it go off. Turning it ON needs nothing.
 */
export function IdentityCheckToggleRow() {
  const styles = useStyles();
  const enabled = useSecurityPrefsStore((s) => s.identityCheckEnabled);
  const setEnabled = useSecurityPrefsStore((s) => s.setIdentityCheckEnabled);
  const [checking, setChecking] = useState(false);

  const onChange = async (next: boolean) => {
    if (next) {
      setEnabled(true);
      return;
    }
    setChecking(true);
    try {
      const result = await confirmOwner();
      if (result === "passed" || result === "unavailable") setEnabled(false);
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
        testID="switch-identity-check"
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
