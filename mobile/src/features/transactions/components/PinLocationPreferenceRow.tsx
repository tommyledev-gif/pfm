import { Text, View } from "react-native";

import { MapPinIcon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";

const TITLE = "Ghim vị trí khi tạo giao dịch";
const HINT = "Bật sẵn cho mỗi giao dịch mới — vẫn tắt được riêng từng giao dịch.";

// Settings' default for the new-Transaction form's location switch. Laid out
// like the menu rows it is grouped with under "Cài đặt người dùng" — icon,
// label, control — so the group reads as one list.
export function PinLocationPreferenceRow() {
  const colors = useColors();
  const styles = useStyles();
  const enabled = useUiPrefsStore((s) => s.pinLocationByDefault);
  const setEnabled = useUiPrefsStore((s) => s.setPinLocationByDefault);

  return (
    <View style={styles.row}>
      <MapPinIcon size={20} color={colors.textSecondary} />
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
  text: { flex: 1, gap: 2 },
  title: { ...typography.body, color: colors.textPrimary },
  hint: { ...typography.tiny, color: colors.textSecondary },
}));
