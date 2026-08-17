import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import {
  ChevronRightIcon,
  HelpIcon,
  LogOutIcon,
  ShieldIcon,
  TagIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { formatCurrency } from "@/lib/currency";
import { colors, spacing, typography } from "@/lib/theme";
import { useSessionStore } from "@/stores/session-store";
import { useChatStore } from "@/stores/chat-store";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { totalBalance } from "@/features/wallets/wallet-totals";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";

// Security/Help & Support have no mobile screens yet — out of the design
// handoff's scope (it maps them as entry points only). Wallets/Categories/
// Household Members now navigate to real management screens.
const SETTINGS_ROWS = [
  { label: "Wallets", Icon: WalletIcon, href: "/wallets" as const },
  { label: "Categories", Icon: TagIcon, href: "/categories" as const },
  { label: "Household Members", Icon: UsersIcon, href: "/users" as const },
  { label: "Security", Icon: ShieldIcon, href: null },
  { label: "Help & Support", Icon: HelpIcon, href: null },
];

function displayNameFromEmail(email: string | null): string {
  if (!email) return "Member";
  const local = email.split("@")[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default function ProfileScreen() {
  const router = useRouter();
  const email = useSessionStore((s) => s.email);
  const clearSession = useSessionStore((s) => s.clear);
  const clearChat = useChatStore((s) => s.clear);
  const wallets = useWalletsQuery();
  const summary = useReportSummaryQuery();
  const name = displayNameFromEmail(email);

  const netWorth = wallets.data ? totalBalance(wallets.data) : null;
  const primaryTotal = summary.data?.totals[0];

  const logout = () => {
    clearChat();
    clearSession();
  };

  return (
    <Screen>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.identity}>
        <Avatar name={name} size={72} />
        <Text style={styles.name}>{name}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}
      </View>

      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Net Worth</Text>
          <Text style={styles.statValue} numberOfLines={1}>
            {netWorth ? formatCurrency(netWorth.amount, netWorth.currency) : "—"}
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Income</Text>
          <Text style={[styles.statValue, { color: colors.green }]} numberOfLines={1}>
            {primaryTotal ? formatCurrency(primaryTotal.total_income, primaryTotal.currency) : "—"}
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Expense</Text>
          <Text style={[styles.statValue, { color: colors.peach }]} numberOfLines={1}>
            {primaryTotal ? formatCurrency(primaryTotal.total_expense, primaryTotal.currency) : "—"}
          </Text>
        </Card>
      </View>

      <View style={styles.settingsGroup}>
        {SETTINGS_ROWS.map(({ label, Icon, href }) => (
          <Pressable key={label} style={styles.row} onPress={href ? () => router.push(href) : undefined} disabled={!href}>
            <Icon size={20} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>{label}</Text>
            <ChevronRightIcon size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.logoutRow} onPress={logout}>
        <LogOutIcon size={20} />
        <Text style={styles.logoutLabel}>Log out</Text>
      </Pressable>
    </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 140, gap: spacing.xl },
  identity: { alignItems: "center", gap: spacing.xs },
  name: { ...typography.title, color: colors.textPrimary, marginTop: spacing.sm },
  email: { ...typography.caption, color: colors.textSecondary },
  statRow: { flexDirection: "row", gap: spacing.sm },
  statCard: { flex: 1, gap: 4, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: "center" },
  statLabel: { ...typography.tiny, color: colors.textSecondary },
  statValue: { ...typography.label, color: colors.textPrimary },
  settingsGroup: { gap: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
  },
  rowLabel: { flex: 1, ...typography.body, color: colors.textPrimary },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  logoutLabel: { ...typography.body, color: colors.peach },
});
