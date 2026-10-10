import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Screen } from "@/components/shared/Screen";
import { ChevronLeftIcon } from "@/components/ui/Icon";
import { EditProfileForm } from "@/features/profile/components/EditProfileForm";
import { spacing, typography, createStyles } from "@/lib/theme";

// Entry points: Settings' avatar and its top-right edit button.
export default function EditProfileScreen() {
  const styles = useStyles();
  const router = useRouter();

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} testID="btn-edit-profile-back" accessibilityLabel="Quay lại">
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>Hồ sơ</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <EditProfileForm onSaved={() => router.back()} />
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
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
}));
