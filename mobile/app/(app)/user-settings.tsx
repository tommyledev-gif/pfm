import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Screen } from "@/components/shared/Screen";
import { useFabBottom } from "@/components/ui/Fab";
import { ChevronLeftIcon } from "@/components/ui/Icon";
import { ThemePicker } from "@/features/settings/components/ThemePicker";
import { PinLocationPreferenceRow } from "@/features/transactions/components/PinLocationPreferenceRow";
import { spacing, typography, createStyles } from "@/lib/theme";

// Entry point: Settings' "Cài đặt người dùng" row. How the app looks and
// behaves for this User, kept apart from the data-management rows there.
// The theme tiles sit right here rather than behind a "Giao diện" row: there
// are only two of them, and a screen of their own was one tap too many. The
// picker applies a theme the moment it is tapped, so there is no save step.
export default function UserSettingsScreen() {
  const styles = useStyles();
  const router = useRouter();
  // Clear of the floating BottomNav, which covers the screen's foot.
  const navClearance = useFabBottom();

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} testID="btn-user-settings-back" accessibilityLabel="Quay lại">
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>Cài đặt người dùng</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: navClearance }]}>
        <ThemePicker />
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
  content: { paddingHorizontal: spacing.xl, gap: spacing.md },
}));
