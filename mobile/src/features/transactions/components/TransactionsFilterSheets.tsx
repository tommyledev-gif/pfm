import { DateRangePickerModal } from "@/components/shared/DateRangePickerModal";
import { Category } from "@/features/categories/types";
import { Wallet } from "@/features/wallets/types";
import { CategoryFilterModal } from "@/features/transactions/components/CategoryFilterModal";
import { SortDrawerModal } from "@/features/transactions/components/SortDrawerModal";
import { WalletFilterModal } from "@/features/transactions/components/WalletFilterModal";
import { TransactionsSheet } from "@/features/transactions/hooks/use-transactions-sheets";
import { SortKey } from "@/features/transactions/sort";

interface TransactionsFilterSheetsProps {
  open: TransactionsSheet | null;
  onClose: () => void;
  wallets: Wallet[];
  walletId: string | undefined;
  onSelectWallet: (walletId: string | undefined) => void;
  dateRange: { from?: string; to?: string };
  onApplyDateRange: (range: { from?: string; to?: string }) => void;
  categories: Category[];
  categoryIds: string[];
  onApplyCategories: (ids: string[]) => void;
  sortKeys: SortKey[];
  onApplySort: (keys: SortKey[]) => void;
}

// The Transactions screen's filter and sort sheets, split out of the screen
// to keep it under the 300-line cap. Each one is opened from its chip or
// button in TransactionsHeader; `open` names the one showing.
export function TransactionsFilterSheets({
  open,
  onClose,
  wallets,
  walletId,
  onSelectWallet,
  dateRange,
  onApplyDateRange,
  categories,
  categoryIds,
  onApplyCategories,
  sortKeys,
  onApplySort,
}: TransactionsFilterSheetsProps) {
  return (
    <>
      <WalletFilterModal
        visible={open === "wallet"}
        onClose={onClose}
        wallets={wallets}
        selectedId={walletId}
        onSelect={onSelectWallet}
      />
      <DateRangePickerModal
        visible={open === "date"}
        onClose={onClose}
        from={dateRange.from}
        to={dateRange.to}
        onApply={onApplyDateRange}
      />
      <CategoryFilterModal
        visible={open === "category"}
        onClose={onClose}
        categories={categories}
        selectedIds={categoryIds}
        onApply={onApplyCategories}
      />
      <SortDrawerModal visible={open === "sort"} onClose={onClose} selected={sortKeys} onApply={onApplySort} />
    </>
  );
}
