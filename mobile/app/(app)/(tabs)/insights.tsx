import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";

import { MotionHighlight, useOptionRects } from "@/components/motion/MotionHighlight";
import { ENTER_OFFSET, SPRING } from "@/components/motion/motion-tokens";
import { Screen } from "@/components/shared/Screen";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { SpendingTab } from "@/features/reports/components/SpendingTab";
import { BudgetsTab } from "@/features/budgets/components/BudgetsTab";
import { BudgetWizardModal } from "@/features/budget-wizard/components/BudgetWizardModal";

// Keys stay English: Home deep-links here with `tab: "Budgets"`.
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
  // From a budget notification (categoryId) or Home's "sắp vượt" list (tab +
  // from/to). Read on the first render too, so a deep link never mounts the
  // other tab first.
  const { categoryId, focusedAt, tab: tabParam, from, to } = useLocalSearchParams<{
    categoryId?: string;
    focusedAt?: string;
    tab?: string;
    from?: string;
    to?: string;
  }>();
  const [tab, setTab] = useState<SubTab>(() => (tabParam === "Budgets" ? "Budgets" : "Spending"));
  const [wizardOpen, setWizardOpen] = useState(false);
  const { rects, onOptionLayout } = useOptionRects();
  const activeRect = rects[tab];

  // A pane mounts on its first visit and then stays, so switching back is
  // instant instead of refetching and redrawing the whole tab.
  const visited = useRef(new Set<SubTab>()).current;
  visited.add(tab);
  const firstTab = useRef(tab).current;

  useEffect(() => {
    if (categoryId) setTab("Spending");
  }, [categoryId, focusedAt]);

  useEffect(() => {
    if (tabParam === "Budgets") setTab("Budgets");
  }, [tabParam, from, to]);

  const openBudgets = useCallback(() => setTab("Budgets"), []);
  const openWizard = useCallback(() => setWizardOpen(true), []);
  const closeWizard = useCallback(() => setWizardOpen(false), []);
  const initialRange = useMemo(() => (from || to ? { from, to } : undefined), [from, to]);

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
            {/* Keeps the tabs the same height; the highlight draws the line once measured. */}
            <View style={[styles.underlineSlot, tab === t.key && !activeRect && styles.underlineStatic]} />
          </Pressable>
        ))}
      </View>

      {visited.has("Spending") ? (
        <SubTabPane active={tab === "Spending"} fromSide={-1} animateFirst={firstTab !== "Spending"}>
          <SpendingTab focusCategoryId={categoryId} focusNonce={focusedAt} onOpenBudgets={openBudgets} />
        </SubTabPane>
      ) : null}
      {visited.has("Budgets") ? (
        <SubTabPane active={tab === "Budgets"} fromSide={1} animateFirst={firstTab !== "Budgets"}>
          <BudgetsTab
            initialRange={initialRange}
            rangeNonce={`${from ?? ""}-${to ?? ""}`}
            onOpenBudgetWizard={openWizard}
          />
        </SubTabPane>
      ) : null}

      {/* At the screen's root: the wizard is a full-screen overlay positioned
          against its parent, and the tab body is inset. */}
      <BudgetWizardModal visible={wizardOpen} onClose={closeWizard} />
    </Screen>
  );
}

interface SubTabPaneProps {
  active: boolean;
  /** -1: slides in from the left, 1: from the right. */
  fromSide: number;
  /** Slide in when first mounted; off for the tab the screen opens on. */
  animateFirst: boolean;
  children: ReactNode;
}

// Hidden panes stay mounted but take no layout; the newly active one slides
// in on the UI thread.
function SubTabPane({ active, fromSide, animateFirst, children }: SubTabPaneProps) {
  const styles = useStyles();
  const shown = useSharedValue(active && !animateFirst ? 1 : 0);

  useEffect(() => {
    shown.value = active ? withSpring(1, SPRING) : 0;
  }, [active, shown]);

  const motion = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: (1 - shown.value) * fromSide * ENTER_OFFSET * 2 }],
  }));

  return <Animated.View style={[styles.body, !active && styles.hidden, motion]}>{children}</Animated.View>;
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
  // Tight on purpose: the title and tabs stay put above both panes, so every
  // pixel here is one the lists below do not get.
  screen: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.md },
  title: { ...typography.title, color: colors.textPrimary },
  tabRow: { flexDirection: "row", gap: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  tabButton: { paddingBottom: spacing.sm, alignItems: "center", gap: spacing.sm },
  tabLabel: { ...typography.body },
  underlineSlot: { height: UNDERLINE_HEIGHT, alignSelf: "stretch", borderRadius: 1 },
  underlineStatic: { backgroundColor: colors.green },
  // Where the slot above sits: the tab's bottom padding up from the border.
  underline: { bottom: spacing.sm, height: UNDERLINE_HEIGHT, backgroundColor: colors.green, borderRadius: 1 },
  body: { flex: 1 },
  hidden: { display: "none" },
}));
