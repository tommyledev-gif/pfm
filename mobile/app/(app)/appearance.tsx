import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Screen } from "@/components/shared/Screen";
import { ChevronLeftIcon } from "@/components/ui/Icon";
import { ThemePicker } from "@/features/settings/components/ThemePicker";
import { spacing, typography, createStyles } from "@/lib/theme";

// Entry point: Settings' "Giao diện" row. The picker applies a theme the
// moment it is tapped, so this screen has no save step of its own.
export default function AppearanceScreen() {
  const styles = useStyles();
  const router = useRouter();

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} testID="btn-appearance-back" accessibilityLabel="Quay lại">
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>Giao diện</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemePicker />
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
  content: { paddingHorizontal: spacing.xl },
}));
