import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

import { MotionView } from "@/components/motion/MotionView";
import { ListSection } from "@/components/ui/grouped-list";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { useFabBottom } from "@/components/ui/Fab";
import { LanguagePicker } from "@/features/settings/components/LanguagePicker";
import { ThemePicker } from "@/features/settings/components/ThemePicker";
import { PinLocationDefaultRow } from "@/features/settings/components/PinLocationDefaultRow";
import { spacing, createStyles } from "@/lib/theme";

// Entry point: Settings' "Cài đặt người dùng" row. How the app looks and
// behaves for this User, kept apart from the data-management rows there.
// The theme tiles sit right here rather than behind a "Giao diện" row: there
// are only two of them, and a screen of their own was one tap too many. The
// pickers apply the moment they are tapped, so there is no save step.
export default function UserSettingsScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  // Clear of the floating BottomNav, which covers the screen's foot.
  const navClearance = useFabBottom();

  return (
    <Screen style={styles.screen}>
      <ScreenHeader title={t("nav.title.userSettings")} backTestID="btn-user-settings-back" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: navClearance }]}>
        <MotionView index={0}>
          <ThemePicker />
        </MotionView>
        <MotionView index={1}>
          <LanguagePicker />
        </MotionView>
        <MotionView index={2}>
          <ListSection header={t("userSettings.transactions.header")}>
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
