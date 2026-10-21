import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";

import { MotionHighlight, useOptionRects } from "@/components/motion/MotionHighlight";
import { entrance } from "@/components/motion/motion-tokens";
import { Screen } from "@/components/shared/Screen";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { SpendingTab } from "@/features/reports/components/SpendingTab";
import { BudgetsTab } from "@/features/budgets/components/BudgetsTab";
import { BudgetWizardModal } from "@/features/budget-wizard/components/BudgetWizardModal";

// Keys stay English because they cross a navigation boundary — Home deep-links
// here with `tab: "Budgets"`. Only what the user reads is translated.
const SUB_TABS = [
  { key: "Spending", label: "Chi tiêu" },
  { key: "Budgets", label: "Ngân sách" },
] as const;
type SubTab = (typeof SUB_TABS)[number]["key"];

const UNDERLINE_HEIGHT = 2;
const LABEL_FADE_MS = 180;

export default function InsightsScreen() {
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const [tab, setTab] = useState<SubTab>("Spending");
  const [wizardOpen, setWizardOpen] = useState(false);
  // The underline slides between the tabs (MotionHighlight) instead of
  // jumping; until both are measured it is drawn under the active one as before.
  const { rects, onOptionLayout } = useOptionRects();
  const activeRect = rects[tab];
  // The new tab's content slides in from the side its tab sits on. The tab
  // on screen when this first mounts just shows.
  const firstRender = useRef(true);
  useEffect(() => {
    firstRender.current = false;
  }, []);
  const tabIndex = SUB_TABS.findIndex((t) => t.key === tab);
  // Deep link from a budget notification (app/(app)/notifications.tsx): force
  // the Spending tab and hand the category down so its donut segment opens
  // selected. `focusedAt` is the nonce that lets the same category be focused
  // twice in a row — see the comment at the push site.
  //
  // Home's "sắp vượt" list deep-links the other way: it forces the Budgets tab
  // and hands over the exact day it was showing, so tapping a budget there lands
  // on the same window rather than on the whole month.
  const { categoryId, focusedAt, tab: tabParam, from, to } = useLocalSearchParams<{
    categoryId?: string;
    focusedAt?: string;
    tab?: string;
    from?: string;
    to?: string;
  }>();

  useEffect(() => {
    if (categoryId) setTab("Spending");
  }, [categoryId, focusedAt]);

  useEffect(() => {
    if (tabParam === "Budgets") setTab("Budgets");
  }, [tabParam, from, to]);

  return (
    <Screen style={styles.screen}>
      <Text style={styles.title}>Phân tích</Text>

      <View style={styles.tabRow}>
        {activeRect ? <MotionHighlight rect={activeRect} style={styles.underline} /> : null}
        {SUB_TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            onLayout={(e) => onOptionLayout(t.key, e)}
            style={styles.tabButton}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t.key }}
          >
            <SubTabLabel label={t.label} active={tab === t.key} reduceMotion={reduceMotion} />
            {/* Keeps every tab the same height; the line itself is drawn
                by the highlight once the tabs are measured. */}
            <View style={[styles.underlineSlot, tab === t.key && !activeRect && styles.underlineStatic]} />
          </Pressable>
        ))}
      </View>

      <Animated.View
        key={tab}
        entering={firstRender.current ? undefined : entrance(tabIndex > 0 ? "slideLeft" : "slideRight")}
        style={styles.body}
      >
        {tab === "Spending" ? (
          <SpendingTab focusCategoryId={categoryId} focusNonce={focusedAt} onOpenBudgets={() => setTab("Budgets")} />
        ) : (
          <BudgetsTab
            initialRange={from || to ? { from, to } : undefined}
            rangeNonce={`${from ?? ""}-${to ?? ""}`}
            onOpenBudgetWizard={() => setWizardOpen(true)}
          />
        )}
      </Animated.View>

      {/* At the screen's root, not inside BudgetsTab: the wizard is a
          full-screen overlay positioned against its parent, and the tab body
          is inset by this screen's padding and title. Same placement as the
          chat screen's ChatOverlays. */}
      <BudgetWizardModal visible={wizardOpen} onClose={() => setWizardOpen(false)} />
    </Screen>
  );
}

// The label's colour fades with the underline's slide rather than cutting.
function SubTabLabel({ label, active, reduceMotion }: { label: string; active: boolean; reduceMotion: boolean }) {
  const colors = useColors();
  const styles = useStyles();
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    const target = active ? 1 : 0;
    on.value = reduceMotion ? target : withTiming(target, { duration: LABEL_FADE_MS });
  }, [active, reduceMotion, on]);

  const { textMuted, textPrimary } = colors;
  const colorStyle = useAnimatedStyle(() => ({ color: interpolateColor(on.value, [0, 1], [textMuted, textPrimary]) }));
  return <Animated.Text style={[styles.tabLabel, colorStyle]}>{label}</Animated.Text>;
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary },
  tabRow: { flexDirection: "row", gap: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  tabButton: { paddingBottom: spacing.sm, alignItems: "center", gap: spacing.sm },
  tabLabel: { ...typography.body },
  underlineSlot: { height: UNDERLINE_HEIGHT, alignSelf: "stretch", borderRadius: 1 },
  underlineStatic: { backgroundColor: colors.green },
  // Where the slot above sits: the tab's bottom padding up from the border.
  underline: { bottom: spacing.sm, height: UNDERLINE_HEIGHT, backgroundColor: colors.green, borderRadius: 1 },
  body: { flex: 1 },
}));
