import { Pressable, View } from "react-native";

import { ChevronDownIcon, TrashIcon } from "@/components/ui/Icon";
import { useColors } from "@/lib/theme";
import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";

interface LineRowActionsProps {
  index: number;
  count: number;
  onMove: (delta: number) => void;
  onRemove: () => void;
  removeLabel: string;
  testIDPrefix: string;
}

const ICON_SIZE = 18;
const UP = { transform: [{ rotate: "180deg" }] };

// Reorder by buttons, not drag: no gesture-handler in Expo Go (CURRENT_STATE).
export function LineRowActions({ index, count, onMove, onRemove, removeLabel, testIDPrefix }: LineRowActionsProps) {
  const colors = useColors();
  const styles = useItemsEditorStyles();
  const isFirst = index === 0;
  const isLast = index === count - 1;
  return (
    <View style={styles.row}>
      <Pressable
        testID={`btn-move-${testIDPrefix}-up-${index}`}
        accessibilityRole="button"
        accessibilityLabel="Đưa lên"
        disabled={isFirst}
        onPress={() => onMove(-1)}
        style={[styles.iconButton, isFirst && styles.iconButtonDisabled]}
      >
        <View style={UP}>
          <ChevronDownIcon size={ICON_SIZE} color={colors.textSecondary} />
        </View>
      </Pressable>
      <Pressable
        testID={`btn-move-${testIDPrefix}-down-${index}`}
        accessibilityRole="button"
        accessibilityLabel="Đưa xuống"
        disabled={isLast}
        onPress={() => onMove(1)}
        style={[styles.iconButton, isLast && styles.iconButtonDisabled]}
      >
        <ChevronDownIcon size={ICON_SIZE} color={colors.textSecondary} />
      </Pressable>
      <Pressable
        testID={`btn-remove-${testIDPrefix}-${index}`}
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
        onPress={onRemove}
        style={styles.iconButton}
      >
        <TrashIcon size={ICON_SIZE} color={colors.error} />
      </Pressable>
    </View>
  );
}
