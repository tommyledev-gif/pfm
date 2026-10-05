import { Pressable, Text, View } from "react-native";

import { MapPinIcon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { TransactionLocationInput } from "@/features/transactions/types";
import { formatCoordinates } from "@/features/transactions/location/map-support";

interface LocationToggleRowProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  // The pin already confirmed for this sheet, if any — tapping it reopens it.
  pinned: TransactionLocationInput | null;
  onPressPinned: () => void;
}

const TITLE = "Ghim vị trí";

// The new-Transaction form's own location switch: starts from Settings'
// preference, and flipping it here affects only the Transaction being filled.
export function LocationToggleRow({ value, onValueChange, pinned, onPressPinned }: LocationToggleRowProps) {
  const colors = useColors();
  const styles = useStyles();

  const hint = !value
    ? "Không lưu vị trí cho giao dịch này"
    : pinned
      ? `${pinned.place_name ?? formatCoordinates(pinned)} · Xem / sửa`
      : "Bật GPS và ghim vị trí lên bản đồ khi lưu";

  return (
    <View style={styles.row}>
      <MapPinIcon size={20} color={value ? colors.green : colors.textMuted} />
      <Pressable style={styles.text} onPress={pinned ? onPressPinned : undefined} disabled={!pinned}>
        <Text style={styles.title}>{TITLE}</Text>
        <Text style={[styles.hint, pinned && styles.hintPinned]} numberOfLines={1}>
          {hint}
        </Text>
      </Pressable>
      <Toggle
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={TITLE}
        testID="switch-transaction-pin-location"
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  text: { flex: 1, gap: 2 },
  title: { ...typography.label, color: colors.textPrimary },
  hint: { ...typography.tiny, color: colors.textMuted },
  hintPinned: { color: colors.green },
}));
