import { GestureResponderHandlers, View } from "react-native";

import { withAlpha } from "@/lib/color";
import { createStyles } from "@/lib/theme";

/**
 * The grab bar at the top of every bottom sheet — tells the user the sheet
 * can be dragged, and is the only place the drag gesture listens (see
 * use-sheet-drag). The strip is much taller than the visible bar so it is an
 * easy target for a thumb.
 */
export function SheetHandle({ panHandlers }: { panHandlers: GestureResponderHandlers }) {
  const styles = useStyles();
  return (
    <View style={styles.strip} {...panHandlers} accessibilityLabel="Kéo để thay đổi kích thước" hitSlop={8}>
      <View style={styles.bar} />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  strip: { width: "100%", alignItems: "center", paddingTop: 10, paddingBottom: 6 },
  bar: { width: 40, height: 4, borderRadius: 2, backgroundColor: withAlpha(colors.overlayBase, 0.28) },
}));
