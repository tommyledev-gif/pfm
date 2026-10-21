import { useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { MotionView } from "@/components/motion/MotionView";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { useFabBottom } from "@/components/ui/Fab";
import { EditProfileForm } from "@/features/profile/components/EditProfileForm";
import { spacing, createStyles } from "@/lib/theme";

// Entry points: Settings' profile card and the avatar on it.
export default function EditProfileScreen() {
  const styles = useStyles();
  const router = useRouter();
  // Clear of the floating BottomNav (it hides only while the keyboard is up).
  const navClearance = useFabBottom();

  return (
    <Screen style={styles.screen}>
      <ScreenHeader title="Hồ sơ" backTestID="btn-edit-profile-back" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: navClearance }]}
        keyboardShouldPersistTaps="handled"
      >
        <MotionView>
          <EditProfileForm onSaved={() => router.back()} />
        </MotionView>
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: spacing.xl },
}));
