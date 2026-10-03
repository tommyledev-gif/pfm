import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Screen } from "@/components/shared/Screen";
import { spacing, typography, createStyles } from "@/lib/theme";
import { SpendingTab } from "@/features/reports/components/SpendingTab";
import { BudgetsTab } from "@/features/budgets/components/BudgetsTab";

// Keys stay English because they cross a navigation boundary — Home deep-links
// here with `tab: "Budgets"`. Only what the user reads is translated.
const SUB_TABS = [
  { key: "Spending", label: "Chi tiêu" },
  { key: "Budgets", label: "Ngân sách" },
] as const;
type SubTab = (typeof SUB_TABS)[number]["key"];

export default function InsightsScreen() {
  const styles = useStyles();
  const [tab, setTab] = useState<SubTab>("Spending");
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
        {SUB_TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabButton}>
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
            {tab === t.key ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.body}>
        {tab === "Spending" ? (
          <SpendingTab focusCategoryId={categoryId} focusNonce={focusedAt} />
        ) : (
          <BudgetsTab initialRange={from || to ? { from, to } : undefined} rangeNonce={`${from ?? ""}-${to ?? ""}`} />
        )}
      </View>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary },
  tabRow: { flexDirection: "row", gap: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  tabButton: { paddingBottom: spacing.sm, alignItems: "center", gap: spacing.sm },
  tabLabel: { ...typography.body, color: colors.textMuted },
  tabLabelActive: { color: colors.textPrimary },
  tabUnderline: { height: 2, width: "100%", backgroundColor: colors.green, borderRadius: 1 },
  body: { flex: 1 },
}));
