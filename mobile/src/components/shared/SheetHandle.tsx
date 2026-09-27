import { GestureResponderHandlers, StyleSheet, View } from "react-native";

/**
 * The grab bar at the top of every bottom sheet — tells the user the sheet
 * can be dragged, and is the only place the drag gesture listens (see
 * use-sheet-drag). The strip is much taller than the visible bar so it is an
 * easy target for a thumb.
 */
export function SheetHandle({ panHandlers }: { panHandlers: GestureResponderHandlers }) {
  return (
    <View style={styles.strip} {...panHandlers} accessibilityLabel="Kéo để thay đổi kích thước" hitSlop={8}>
      <View style={styles.bar} />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { width: "100%", alignItems: "center", paddingTop: 10, paddingBottom: 6 },
  bar: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.28)" },
});
