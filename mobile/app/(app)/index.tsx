import { useMemo } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { EditIcon, PlusIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { TopBar } from "@/components/shared/TopBar";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { WalletCard } from "@/components/shared/WalletCard";
import { formatCurrency } from "@/lib/currency";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { totalBalance } from "@/features/wallets/wallet-totals";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";

export default function HomeScreen() {
  const router = useRouter();
  const wallets = useWalletsQuery();
  const recent = useTransactionsQuery({ limit: 4 });

  const walletCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    wallets.data?.forEach((w) => map.set(w.id, w.currency));
    return map;
  }, [wallets.data]);

  const total = wallets.data ? totalBalance(wallets.data) : null;
  const recentTransactions = recent.data?.pages[0]?.data.slice(0, 4) ?? [];

  return (
    <Screen>
      <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={recentTransactions}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={
        <>
          <TopBar userName="Me" />

          <View style={styles.hero}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>Total Balance · All Wallets</Text>
            </View>
            <Text style={styles.heroAmount}>
              {total ? formatCurrency(total.amount, total.currency) : wallets.isLoading ? "…" : formatCurrency(0)}
            </Text>
            <View style={styles.heroActions}>
              <Pressable style={styles.heroIconButton} hitSlop={8}>
                <EditIcon size={18} color={colors.green} />
              </Pressable>
              <Pressable style={styles.addButton} onPress={() => router.push("/ai-chat")}>
                <PlusIcon size={18} color={colors.green} />
                <Text style={styles.addButtonLabel}>Add Transaction</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Your Wallets</Text>
          {wallets.isLoading ? (
            <ActivityIndicator color={colors.green} style={styles.loader} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.walletRow}>
              {wallets.data?.map((w) => (
                <WalletCard key={w.id} wallet={w} />
              ))}
            </ScrollView>
          )}

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <Pressable onPress={() => router.push("/transactions")} hitSlop={8}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
        </>
      }
      renderItem={({ item }) => <TransactionRow transaction={item} currency={walletCurrencyMap.get(item.wallet_id)} />}
      ListEmptyComponent={
        recent.isLoading ? (
          <ActivityIndicator color={colors.green} style={styles.loader} />
        ) : (
          <Text style={styles.empty}>No transactions yet.</Text>
        )
      }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingBottom: 140, paddingHorizontal: spacing.xl, gap: spacing.md },
  hero: { backgroundColor: colors.green, borderRadius: radii.hero, padding: spacing.xl, gap: spacing.md, marginTop: spacing.sm },
  heroPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.onGreen,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  heroPillText: { ...typography.tiny, color: colors.green },
  heroAmount: { ...typography.hero, color: colors.onGreen },
  heroActions: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  heroIconButton: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.onGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  addButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.onGreen,
  },
  addButtonLabel: { ...typography.body, color: colors.green },
  sectionTitle: { ...typography.cardTitle, color: colors.textPrimary, marginTop: spacing.sm },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  seeAll: { ...typography.caption, color: colors.green },
  walletRow: { gap: spacing.md, paddingBottom: spacing.xs },
  loader: { marginVertical: spacing.lg },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
