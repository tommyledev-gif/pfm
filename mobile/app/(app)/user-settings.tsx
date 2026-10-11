import { useRef } from "react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Screen } from "@/components/shared/Screen";
import { ChevronLeftIcon, ChevronRightIcon, PaletteIcon } from "@/components/ui/Icon";
import { PinLocationPreferenceRow } from "@/features/transactions/components/PinLocationPreferenceRow";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";

// Taps closer together than this count as one (same guard as Settings' rows).
const ROW_TAP_GUARD_MS = 600;

// Entry point: Settings' "Cài đặt người dùng" row. How the app looks and
// behaves for this User, kept apart from the data-management rows there.
export default function UserSettingsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const lastPushAt = useRef(0);

  const openAppearance = () => {
    const now = Date.now();
    if (now - lastPushAt.current < ROW_TAP_GUARD_MS) return;
    lastPushAt.current = now;
    router.push("/appearance");
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} testID="btn-user-settings-back" accessibilityLabel="Quay lại">
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>Cài đặt người dùng</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.row} onPress={openAppearance} testID="row-settings-appearance">
          <PaletteIcon size={20} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Giao diện</Text>
          <ChevronRightIcon size={18} color={colors.textMuted} />
        </Pressable>
        <PinLocationPreferenceRow />
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
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
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.xs },
  // Settings' menu-row look, so this list reads like the one it came from.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
  },
  rowLabel: { flex: 1, ...typography.body, color: colors.textPrimary },
}));
