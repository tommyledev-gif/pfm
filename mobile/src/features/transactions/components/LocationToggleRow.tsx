import { Pressable, Text, View } from "react-native";

import { MapPinIcon } from "@/components/ui/Icon";
import { Toggle } from "@/components/ui/Toggle";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
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
// Row height: one line, so the keypad below is not pushed further down.
const ROW_MIN_HEIGHT = 40;

// The new-Transaction form's own location switch: starts from Settings'
// preference, and flipping it here affects only the Transaction being filled.
//
// A single inline row — icon, title, switch — with no card, border or
// explanatory second line: this sits in the quick-entry sheet above the
// keypad, and every line here pushes the amount further down. A pin already
// confirmed for this sheet is the one extra, shown inline and tappable.
export function LocationToggleRow({ value, onValueChange, pinned, onPressPinned }: LocationToggleRowProps) {
  const colors = useColors();
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <MapPinIcon size={18} color={value ? colors.green : colors.textMuted} />
      <Text style={styles.title}>{TITLE}</Text>
      {pinned ? (
        <Pressable
          style={styles.pinned}
          onPress={onPressPinned}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Xem / sửa vị trí đã ghim"
        >
          <Text style={styles.pinnedLabel} numberOfLines={1}>
            {pinned.place_name ?? formatCoordinates(pinned)}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
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
    gap: spacing.sm,
    minHeight: ROW_MIN_HEIGHT,
    paddingVertical: spacing.xs,
  },
  title: { ...typography.label, color: colors.textPrimary },
  spacer: { flex: 1 },
  pinned: { flex: 1, minWidth: 0, alignItems: "flex-end" },
  pinnedLabel: { ...typography.tiny, color: colors.green },
}));
