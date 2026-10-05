import { Text, View } from "react-native";

import { Toggle } from "@/components/ui/Toggle";
import { createStyles, radii, spacing, typography } from "@/lib/theme";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";

const TITLE = "Ghim vị trí khi tạo giao dịch";
const HINT = "Bật sẵn cho mỗi giao dịch mới: khi lưu sẽ lấy GPS và ghim lên bản đồ. Vẫn có thể tắt riêng cho từng giao dịch.";

// Settings' default for the new-Transaction form's location switch.
export function PinLocationPreferenceRow() {
  const styles = useStyles();
  const enabled = useUiPrefsStore((s) => s.pinLocationByDefault);
  const setEnabled = useUiPrefsStore((s) => s.setPinLocationByDefault);

  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.title}>{TITLE}</Text>
        <Text style={styles.hint}>{HINT}</Text>
      </View>
      <Toggle
        value={enabled}
        onValueChange={setEnabled}
        accessibilityLabel={TITLE}
        testID="switch-settings-pin-location"
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
