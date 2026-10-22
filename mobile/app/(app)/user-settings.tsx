import { ScrollView } from "react-native";

import { MotionView } from "@/components/motion/MotionView";
import { ListSection } from "@/components/ui/grouped-list";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { useFabBottom } from "@/components/ui/Fab";
import { ThemePicker } from "@/features/settings/components/ThemePicker";
import { PIN_LOCATION_FOOTER, PinLocationDefaultRow } from "@/features/settings/components/PinLocationDefaultRow";
import { spacing, createStyles } from "@/lib/theme";

const TRANSACTIONS_HEADER = "Giao dịch";

// Entry point: Settings' "Cài đặt người dùng" row. How the app looks and
// behaves for this User, kept apart from the data-management rows there.
// The theme tiles sit right here rather than behind a "Giao diện" row: there
// are only two of them, and a screen of their own was one tap too many. The
// picker applies a theme the moment it is tapped, so there is no save step.
export default function UserSettingsScreen() {
  const styles = useStyles();
  // Clear of the floating BottomNav, which covers the screen's foot.
  const navClearance = useFabBottom();

  return (
    <Screen style={styles.screen}>
      <ScreenHeader title="Cài đặt người dùng" backTestID="btn-user-settings-back" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: navClearance }]}>
        <MotionView index={0}>
          <ThemePicker />
        </MotionView>
        <MotionView index={1}>
          <ListSection header={TRANSACTIONS_HEADER}>
            <PinLocationDefaultRow />
          </ListSection>
        </MotionView>
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: spacing.xl, gap: spacing.xxl },
}));
