import { useRouter } from "expo-router";
import { ScrollView } from "react-native";

import { MotionView } from "@/components/motion/MotionView";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { useFabBottom } from "@/components/ui/Fab";
import { spacing, createStyles } from "@/lib/theme";
import { ChangePasswordForm } from "@/features/security/components/ChangePasswordForm";

const TITLE = "Đổi mật khẩu";

// Entry point: the Security screen's "Đổi mật khẩu" row (specs/mobile-account-switch US-11).
export default function ChangePasswordScreen() {
  const styles = useStyles();
  const router = useRouter();
  // The button must clear the floating BottomNav (hidden only while typing).
  const navClearance = useFabBottom();

  return (
    <Screen style={styles.screen}>
      <ScreenHeader title={TITLE} backTestID="btn-change-password-back" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: navClearance }]}
        keyboardShouldPersistTaps="handled"
      >
        <MotionView>
          <ChangePasswordForm onDone={() => router.back()} />
        </MotionView>
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: spacing.xl },
}));
