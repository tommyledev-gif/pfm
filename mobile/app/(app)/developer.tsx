import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ChevronLeftIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";

// Entry point: profile.tsx's "Developer" row. Only toggles DebugBubble's own
// visible UI — the underlying logging (axios.ts interceptors, global-error-
// logger.ts, NavigationLogger) runs unconditionally regardless of this
// toggle, see ui-prefs-store.ts's debugBubbleVisible field comment.
export default function DeveloperScreen() {
  const router = useRouter();
  const bubbleVisible = useUiPrefsStore((s) => s.debugBubbleVisible);
  const setBubbleVisible = useUiPrefsStore((s) => s.setDebugBubbleVisible);

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>Nhà phát triển</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>Hiển thị Debug Bubble</Text>
          <Text style={styles.rowHint}>
            Vẫn ghi log API/điều hướng ngay cả khi ẩn — nút chỉ ẩn giao diện nổi.
          </Text>
        </View>
        <Pressable
          onPress={() => setBubbleVisible(!bubbleVisible)}
          style={[styles.toggle, bubbleVisible && styles.toggleActive]}
        >
          <Text style={[styles.toggleLabel, bubbleVisible && styles.toggleLabelActive]}>
            {bubbleVisible ? "Bật" : "Tắt"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: { flex: 1, ...typography.title, color: colors.textPrimary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
  },
  rowText: { flex: 1, gap: spacing.xs },
  rowLabel: { ...typography.body, color: colors.textPrimary },
  rowHint: { ...typography.caption, color: colors.textSecondary },
  toggle: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  toggleActive: { backgroundColor: colors.green, borderColor: colors.green },
  toggleLabel: { ...typography.label, color: colors.textSecondary },
  toggleLabelActive: { color: colors.onGreen },
});
