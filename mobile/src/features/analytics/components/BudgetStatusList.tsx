import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AmountText } from "@/components/ui/AmountText";
import { AnalyticsBudgetItem } from "@/features/analytics/types";
import { budgetRowStatus } from "@/features/budgets/budget-pace";
import { BudgetIconTile } from "@/features/budgets/components/BudgetIconTile";
import { BudgetProgressBar } from "@/features/budgets/components/BudgetProgressBar";
import { BudgetLimit } from "@/features/budgets/types";
import { useCategoryLookup } from "@/features/categories/api/use-category-lookup";
import { Category } from "@/features/categories/types";
import { formatCurrency } from "@/lib/currency";
import { WalletCurrency } from "@/lib/constants";
import { colors, spacing, typography } from "@/lib/theme";

interface BudgetStatusListProps {
  budgets: AnalyticsBudgetItem[];
  currency: string;
  /** 0..1 of the answer's period gone by — the bars' pace tick. */
  elapsed: number;
}

const BAR_HEIGHT = 6;

// The answer's figures in the Budgets screen's own shape, so its pace logic —
// not a second copy of it — decides each bar's colour.
function asBudgetLimit(b: AnalyticsBudgetItem, currency: string): BudgetLimit {
  return {
    currency: currency as WalletCurrency,
    amount_limit: b.limit,
    spent: b.spent,
    remaining: b.remaining,
    status: b.exceeded ? "exceeded" : "within",
  };
}

// Q9 — the same numbers as the Budgets screen (spec.md S-AIQ-09), drawn with
// the same tile, bar and pace colours, so the two never look like different
// measurements. The question is "how much is left", so the remaining amount
// is each row's headline; spent / limit is the detail under the bar.
//
// Each row's icon: the Budget's own, else its Category's — found by id, or by
// name for an answer stored before category_id was sent (those also carry no
// icon of their own, which is what left them showing a bare initial).
export function BudgetStatusList({ budgets, currency, elapsed }: BudgetStatusListProps) {
  const categories = useCategoryLookup();
  const categoryByName = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories.values()) {
      // Two Categories can share a name (a system one and the User's own);
      // the first with an icon is the more useful match.
      const current = map.get(c.name);
      if (!current || (!current.icon && !current.icon_url)) map.set(c.name, c);
    }
    return map;
  }, [categories]);

  return (
    <View>
      {budgets.map((b, i) => {
        const status = budgetRowStatus(asBudgetLimit(b, currency), elapsed);
        const category = (b.category_id ? categories.get(b.category_id) : undefined) ?? categoryByName.get(b.category_name);
        return (
          <View key={b.budget_id} style={[styles.row, i > 0 && styles.divider]}>
            <BudgetIconTile
              name={b.category_name}
              // || not ??: an icon saved as "" is no icon, and must not
              // hide the Category's.
              icon={b.icon || category?.icon}
              iconUrl={b.icon_url || category?.icon_url}
            />
            <View style={styles.body}>
              <View style={styles.head}>
                <Text style={styles.name} numberOfLines={1}>
                  {b.category_name}
                </Text>
                {status.over ? (
                  <Text style={styles.over}>
                    Vượt <AmountText amountCents={b.spent - b.limit} currency={currency} style={styles.over} />
                  </Text>
                ) : (
                  <AmountText amountCents={b.remaining} currency={currency} style={styles.remaining} />
                )}
              </View>
              <BudgetProgressBar
                ratio={status.ratio}
                // Nothing spent yet: no pace to be behind, and a tick on an
                // empty track only reads as noise.
                pace={status.state === "unused" ? undefined : elapsed}
                color={status.color}
                height={BAR_HEIGHT}
              />
              <Text style={styles.meta} numberOfLines={1}>
                {status.state === "unused"
                  ? `Chưa chi · Hạn mức ${formatCurrency(b.limit, currency)}`
                  : `Đã chi ${formatCurrency(b.spent, currency)} / ${formatCurrency(b.limit, currency)}`}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  body: { flex: 1, gap: spacing.sm },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  name: { ...typography.body, color: colors.textPrimary, flex: 1 },
  remaining: { ...typography.body, color: colors.textPrimary },
  over: { ...typography.body, color: colors.danger },
  meta: { ...typography.caption, color: colors.textSecondary },
});
