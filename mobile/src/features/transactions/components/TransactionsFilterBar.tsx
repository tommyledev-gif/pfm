import { useState } from "react";
import { GestureResponderEvent, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";

import { ActionPopover, PopoverAnchor } from "@/components/shared/ActionPopover";
import { CalendarIcon, CheckIcon } from "@/components/ui/Icon";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { Category } from "@/features/categories/types";
import { categoryLabel } from "@/features/categories/category-label";
import { Wallet } from "@/features/wallets/types";
import { FilterPill } from "@/features/transactions/components/FilterPill";
import { useTransactionFilters } from "@/features/transactions/hooks/use-transaction-filters";
import { TransactionsSheet } from "@/features/transactions/hooks/use-transactions-sheets";

interface TransactionsFilterBarProps {
  filters: ReturnType<typeof useTransactionFilters>;
  wallets: Wallet[] | undefined;
  categoryById: Map<string, Category>;
  /** The applied range, formatted; null while no date filter is set. */
  dateLabel: string | null;
  /** The currencies the User's wallets are in, the list's own first. */
  currencies: string[];
  openers: Record<Exclude<TransactionsSheet, "sort">, () => void>;
}

// The row under the type tabs: the three things that narrow the list, as
// dropdown chips (FilterPill), and nothing else. It used to carry the date
// and category pills alongside Sort and Export with an icon on each, which
// scrolled off the screen edge before a wallet filter was even added; the
// two actions moved up to the title row (TransactionsHeader).
//
// Still a horizontal scroll, for the one case where applied values (a long
// wallet name, a custom range) no longer fit side by side.
//
// The currency pill sits beside the wallet one: the list is always in one
// currency (useTransactionFilters), and this says which, with a small menu to
// change it. An unset date range is a calendar glyph, not the word "Thời gian".
export function TransactionsFilterBar({ filters, wallets, categoryById, dateLabel, currencies, openers }: TransactionsFilterBarProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const { walletId, setWalletId, setDateRange, categoryIds, setCategoryIds, currency, setCurrency } = filters;
  const [currencyMenu, setCurrencyMenu] = useState<PopoverAnchor | null>(null);

  const openCurrencyMenu = (event: GestureResponderEvent) => {
    const target = event.currentTarget as unknown as Pick<View, "measureInWindow">;
    target.measureInWindow((x, y, width, height) => setCurrencyMenu({ x, y, width, height }));
  };
  // A wallet in another currency would leave the list empty: it goes.
  const pickCurrency = (next: string) => {
    setCurrency(next);
    if (walletId && wallets?.find((w) => w.id === walletId)?.currency !== next) setWalletId(undefined);
  };
  // "Ví" still lit when the picked wallet is gone from the list (deleted
  // elsewhere): the filter is on, and its × is how to drop it.
  const walletLabel = walletId ? (wallets?.find((w) => w.id === walletId)?.name ?? t("common.field.wallet")) : null;
  const categoryCount = t("common.count.categories", { count: categoryIds.length });
  const categoryPill =
    categoryIds.length === 0
      ? null
      : categoryIds.length === 1
        ? categoryLabel(categoryById.get(categoryIds[0]), categoryCount)
        : categoryCount;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      <FilterPill
        active={walletLabel !== null}
        label={walletLabel ?? t("common.field.wallet")}
        onPress={openers.wallet}
        onClear={() => setWalletId(undefined)}
        clearLabel={t("transactions.filter.clearWallet")}
        testID="pill-filter-wallet"
      />
      <FilterPill
        active={false}
        label={currency ?? currencies[0]}
        onPress={openCurrencyMenu}
        testID="pill-filter-currency"
      />
      <FilterPill
        active={dateLabel !== null}
        label={dateLabel ?? t("transactions.filter.datePill")}
        icon={CalendarIcon}
        onPress={openers.date}
        onClear={() => setDateRange({})}
        clearLabel={t("transactions.filter.clearDate")}
        testID="pill-filter-date"
      />
      <FilterPill
        active={categoryPill !== null}
        label={categoryPill ?? t("common.field.category")}
        onPress={openers.category}
        onClear={() => setCategoryIds([])}
        clearLabel={t("transactions.filter.clearCategory")}
        testID="pill-filter-category"
      />

      <ActionPopover
        visible={currencyMenu !== null}
        anchor={currencyMenu}
        align="left"
        onClose={() => setCurrencyMenu(null)}
        actions={currencies.map((code) => ({
          Icon: code === currency ? CheckIconGreen : NoIcon,
          label: code,
          onPress: () => pickCurrency(code),
          testID: `btn-filter-currency-${code}`,
        }))}
      />
    </ScrollView>
  );
}

const useStyles = createStyles(() => ({
  // Bleeds through the screen's side padding so a chip scrolls out to the
  // screen edge instead of being cut off at the margin.
  scroll: { marginHorizontal: -spacing.xl },
  row: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl },
}));

// The picked currency is ticked; the others keep the tick's width, so the
// codes line up.
function CheckIconGreen({ size }: { size?: number }) {
  const colors = useColors();
  return <CheckIcon size={size} color={colors.green} />;
}
function NoIcon({ size }: { size?: number }) {
  return <View style={{ width: size, height: size }} />;
}
