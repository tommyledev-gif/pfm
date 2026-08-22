import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PlusIcon } from "@/components/ui/Icon";
import { BudgetCard } from "@/components/shared/BudgetCard";
import { BudgetFormModal } from "@/features/budgets/components/BudgetFormModal";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { WalletCurrency } from "@/lib/constants";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { Budget } from "@/features/budgets/types";
import { BudgetCardSkeleton } from "@/features/budgets/components/BudgetCardSkeleton";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { primaryCurrency } from "@/features/wallets/wallet-totals";

const CARD_SKELETON_COUNT = 3;

// Insights → Budgets tab — README: "+ New budget" top-right action, list of
// budget cards, each showing Budget vs Actual stacked bars scaled to the
// largest limit across all budgets. Tapping a card opens the same modal in
// edit mode.
export function BudgetsTab() {
  const budgets = useBudgetsQuery();
  const wallets = useWalletsQuery();
  const categories = useCategoriesQuery();
  const categoryById = new Map(categories.data?.map((c) => [c.id, c]));
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const currency: WalletCurrency = (wallets.data ? primaryCurrency(wallets.data) : undefined) ?? "VND";

  if (budgets.isLoading) {
    return (
      <View style={styles.list}>
        {Array.from({ length: CARD_SKELETON_COUNT }).map((_, i) => (
          <BudgetCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  const rows = (budgets.data ?? []).flatMap((budget) =>
    budget.limits.map((limit) => ({ budget, limit })),
  );
  const maxLimit = Math.max(1, ...rows.map((r) => r.limit.amount_limit));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.count}>{budgets.data?.length ?? 0} budgets</Text>
        <Pressable
          style={styles.newButton}
          onPress={() => {
            setEditingBudget(null);
            setModalOpen(true);
          }}
        >
          <PlusIcon size={16} color={colors.onGreen} />
          <Text style={styles.newButtonLabel}>New budget</Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
        {rows.length === 0 ? (
          <Text style={styles.empty}>No budgets yet — tap &ldquo;New budget&rdquo; to create one.</Text>
        ) : (
          rows.map(({ budget, limit }) => (
            <Pressable
              key={`${budget.id}-${limit.currency}`}
              onPress={() => {
                setEditingBudget(budget);
                setModalOpen(true);
              }}
            >
              <BudgetCard budget={budget} limit={limit} maxLimit={maxLimit} category={categoryById.get(budget.category_id)} />
            </Pressable>
          ))
        )}
      </ScrollView>

      <BudgetFormModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        currency={currency}
        editingBudget={editingBudget}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: spacing.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  count: { ...typography.caption, color: colors.textSecondary },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.green,
    borderRadius: radii.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  newButtonLabel: { ...typography.caption, color: colors.onGreen },
  list: { gap: spacing.md, paddingBottom: 140 },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
