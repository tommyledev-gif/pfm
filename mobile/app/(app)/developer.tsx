import { ScrollView } from "react-native";
import { useTranslation } from "react-i18next";

import { MotionView } from "@/components/motion/MotionView";
import { ListSection, ListToggleRow } from "@/components/ui/grouped-list";
import { BugGlyph } from "@/components/ui/grouped-list/list-icons";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { useFabBottom } from "@/components/ui/Fab";
import { spacing, createStyles } from "@/lib/theme";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";

// Entry point: Settings' "Nhà phát triển" row. Only toggles DebugBubble's own
// visible UI — the underlying logging (axios.ts interceptors, global-error-
// logger.ts, NavigationLogger) runs unconditionally regardless of this
// toggle, see ui-prefs-store.ts's debugBubbleVisible field comment.
export default function DeveloperScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const bubbleVisible = useUiPrefsStore((s) => s.debugBubbleVisible);
  const setBubbleVisible = useUiPrefsStore((s) => s.setDebugBubbleVisible);
  // Clear of the floating BottomNav, which covers the screen's foot.
  const navClearance = useFabBottom();

  return (
    <Screen style={styles.screen}>
      <ScreenHeader title={t("nav.title.developer")} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: navClearance }]}>
        <MotionView>
          <ListSection footer={t("developer.debugBubble.footer")}>
            <ListToggleRow
              title={t("developer.debugBubble.label")}
              icon={BugGlyph}
              value={bubbleVisible}
              onValueChange={setBubbleVisible}
              testID="toggle-debug-bubble"
            />
          </ListSection>
        </MotionView>
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: spacing.xl },
}));
