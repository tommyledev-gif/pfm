import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/shared/Screen";
import { colors, spacing, typography } from "@/lib/theme";
import { SpendingTab } from "@/features/reports/components/SpendingTab";
import { BudgetsTab } from "@/features/budgets/components/BudgetsTab";

const SUB_TABS = ["Spending", "Budgets"] as const;
type SubTab = (typeof SUB_TABS)[number];

export default function InsightsScreen() {
  const [tab, setTab] = useState<SubTab>("Spending");

  return (
    <Screen style={styles.screen}>
      <Text style={styles.title}>Insights</Text>

      <View style={styles.tabRow}>
        {SUB_TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={styles.tabButton}>
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>{t}</Text>
            {tab === t ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        ))}
      </View>

      <View style={styles.body}>{tab === "Spending" ? <SpendingTab /> : <BudgetsTab />}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp, paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.lg },
  title: { ...typography.title, color: colors.textPrimary },
  tabRow: { flexDirection: "row", gap: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.surfaceBorder },
  tabButton: { paddingBottom: spacing.sm, alignItems: "center", gap: spacing.sm },
  tabLabel: { ...typography.body, color: colors.textMuted },
  tabLabelActive: { color: colors.textPrimary },
  tabUnderline: { height: 2, width: "100%", backgroundColor: colors.green, borderRadius: 1 },
  body: { flex: 1, paddingBottom: 140 },
});
