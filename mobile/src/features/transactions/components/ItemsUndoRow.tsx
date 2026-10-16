import { Pressable, Text, View } from "react-native";

import { useItemsEditorStyles } from "@/features/transactions/components/items-editor-styles";

interface ItemsUndoRowProps {
  label: string;
  onUndo: () => void;
}

/**
 * What a removed line leaves for a few seconds. Plain layout: the editor
 * animates the swap in and the fold away with animateLineLayout, so the lines
 * below slide instead of jumping (it used to animate its own Reanimated
 * height, which had the same unapplied-update problem ExpandableLine had).
 */
export function ItemsUndoRow({ label, onUndo }: ItemsUndoRowProps) {
  const styles = useItemsEditorStyles();
  return (
    <View style={styles.undoRow} accessibilityLiveRegion="polite">
      <Text style={styles.undoLabel} numberOfLines={1}>
        {label}
      </Text>
      <Pressable accessibilityRole="button" onPress={onUndo} hitSlop={12} testID="btn-items-undo">
        <Text style={styles.undoAction}>Hoàn tác</Text>
      </Pressable>
    </View>
  );
}
