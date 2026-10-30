import { useMemo } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { FilterPill } from "@/features/transactions/components/FilterPill";
import { TYPE_OPTIONS, TypeFilterValue } from "@/features/transactions/components/TransactionsHeader";
import { TransactionsSearchField } from "@/features/transactions/components/TransactionsSearchField";
import { SearchFieldSeed } from "@/features/transactions/hooks/use-transaction-filters";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";
import { RolePill } from "@/features/wallets/components/RolePill";
import { SharedWalletChips } from "@/features/wallets/components/SharedWalletChips";

interface SharedActivityHeaderProps {
  wallets: Wallet[];
  faceById: Map<string, string>;
  selected: Wallet;
  onSelectWallet: (walletId: string) => void;
  /** Entries matching every filter; null while that answer is loading. */
  matchedCount: number | null;
  searchSeed: SearchFieldSeed;
  onSearch: (text: string) => void;
  typeFilter: TypeFilterValue;
  onChangeTypeFilter: (value: TypeFilterValue) => void;
  dateLabel: string | null;
  categoryLabel: string | null;
  onOpenDate: () => void;
  onOpenCategory: () => void;
  onClearDate: () => void;
  onClearCategory: () => void;
}

/**
 * Everything above the shared-wallet activity list: which wallet, its shared
 * balance and the User's role in it, then the same search, type tabs and
 * filter chips the Transactions screen has — the list under it is everyone's
 * entries in that wallet, which the Transactions tab (the User's own) never
 * shows (specs/shared-wallets BR-09).
 */
export function SharedActivityHeader({
  wallets,
  faceById,
  selected,
  onSelectWallet,
  matchedCount,
  searchSeed,
  onSearch,
  typeFilter,
  onChangeTypeFilter,
  dateLabel,
  categoryLabel,
  onOpenDate,
  onOpenCategory,
  onClearDate,
  onClearCategory,
}: SharedActivityHeaderProps) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const typeOptions = useMemo(() => TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })), [t]);
  const owner = isOwnWallet(selected)
    ? t("wallets.owner.yours")
    : t("wallets.owner.ownedBy", { owner: selected.owner_name ?? t("wallets.owner.unknown") });
  return (
    <View style={styles.header}>
      <SharedWalletChips wallets={wallets} faceById={faceById} selectedId={selected.id} onSelect={onSelectWallet} />

      <View style={styles.summary}>
        <View style={styles.summaryTexts}>
          <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>
            {formatCurrency(selected.balance, selected.currency)}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta} numberOfLines={1}>
              {owner}
            </Text>
            <RolePill role={selected.access ?? "owner"} />
          </View>
        </View>
        {matchedCount === null ? (
          <ActivityIndicator size="small" color={colors.green} />
        ) : (
          <Text style={styles.count}>{t("common.count.transactions", { count: matchedCount })}</Text>
        )}
      </View>

      <TransactionsSearchField key={searchSeed.key} initialText={searchSeed.text} onSearch={onSearch} />

      <SegmentedTabs options={typeOptions} value={typeFilter} onChange={onChangeTypeFilter} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
        <FilterPill
          active={dateLabel !== null}
          label={dateLabel ?? t("common.field.time")}
          onPress={onOpenDate}
          onClear={onClearDate}
          clearLabel={t("sharedWallets.filter.clearDate")}
          testID="pill-shared-filter-date"
        />
        <FilterPill
          active={categoryLabel !== null}
          label={categoryLabel ?? t("common.field.category")}
          onPress={onOpenCategory}
          onClear={onClearCategory}
          clearLabel={t("sharedWallets.filter.clearCategory")}
          testID="pill-shared-filter-category"
        />
      </ScrollView>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  header: { gap: spacing.md, paddingBottom: spacing.sm },
  summary: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  summaryTexts: { flex: 1, gap: 4 },
  balance: { ...typography.hero, fontSize: 28, color: colors.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  meta: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  count: { ...typography.caption, color: colors.textSecondary },
  filterScroll: { marginHorizontal: -spacing.xl },
  filterRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl },
}));
