import { Pressable, StyleSheet, Text, View } from "react-native";

import { SnapshotProgressRow } from "@/components/shared/SnapshotProgressRow";
import { colors, spacing, typography } from "@/lib/theme";

// Small pieces of HomeSnapshotCard's right-hand column, split out to keep
// that file under the 300-line limit.

// Invisible stand-ins for missing rows — real SnapshotProgressRows at zero
// opacity, so a slot is exactly as tall as a filled one on every device.
export function RowPlaceholders({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View
      style={styles.placeholder}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SnapshotProgressRow key={i} name=" " color={colors.surface} ratio={0} percent={0} barColor={colors.surface} />
      ))}
    </View>
  );
}

export function SnapshotHeader({ title, onPressAll }: { title: string; onPressAll: () => void }) {
  return (
    <View style={styles.compactHeaderRow}>
      <Text style={styles.compactTitle} numberOfLines={2}>
        {title}
      </Text>
      <Pressable onPress={onPressAll} hitSlop={8}>
        <Text style={styles.compactSeeAll} numberOfLines={1}>
          Xem tất cả
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  compactHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  compactTitle: { ...typography.label, color: colors.textPrimary, flexShrink: 1 },
  compactSeeAll: { ...typography.tiny, color: colors.green, flexShrink: 0 },
  placeholder: { opacity: 0, gap: 2 },
});
