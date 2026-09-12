import { dayLabelVi, formatDateViShort } from "@/lib/format-date";
import { Transaction } from "@/features/transactions/types";

export interface DaySection {
  key: string;
  dayLabel: string;
  dateLabel: string;
  // Emptied while the day is collapsed — SectionList still renders the
  // header (with its totals), just none of the rows.
  data: Transaction[];
  // Full row count regardless of collapse, so a collapsed day can still say
  // how much it is hiding.
  count: number;
  // Income and expense are kept apart rather than netted: a day with both
  // reads as "+2.000.000 / -350.000", which is the actual question being
  // asked of a day header, where a single net figure hides half of it.
  //
  // Both go undefined once the day mixes currencies (a multi-wallet day) —
  // a subtotal that silently added VND cents to USD cents would be exactly
  // the "never sum incompatible currencies" bug wallet-totals.ts/
  // budget-totals.ts both already guard against, so this omits the totals
  // entirely rather than risk it.
  income: number | undefined;
  expense: number | undefined;
  currency: string | undefined;
  collapsed: boolean;
}

interface BuildDaySectionsOptions {
  // Grouping by calendar day only reads as a real "day subtotal" list when
  // the effective order is already chronological — an amount sort
  // ("Số tiền cao nhất/thấp nhất") interleaves dates arbitrarily, which would
  // turn day-grouping into dozens of jumbled single-item sections instead of
  // the clean date-grouped list this screen otherwise renders. One ungrouped
  // section (day header hidden) is returned in that case.
  grouped: boolean;
  walletCurrencyMap: Map<string, string>;
  collapsedDays: Set<string>;
}

// Splits an already-sorted transaction list into the SectionList sections the
// Transactions screen renders, accumulating each day's income/expense subtotal
// as it goes. Pure — the screen wraps it in a useMemo.
export function buildDaySections(
  items: Transaction[],
  { grouped, walletCurrencyMap, collapsedDays }: BuildDaySectionsOptions,
): DaySection[] {
  if (!grouped) {
    if (items.length === 0) return [];
    return [
      {
        key: "all",
        dayLabel: "",
        dateLabel: "",
        data: items,
        count: items.length,
        income: undefined,
        expense: undefined,
        currency: undefined,
        collapsed: false,
      },
    ];
  }

  const groups: DaySection[] = [];
  for (const item of items) {
    const dayKey = item.occurred_at.slice(0, 10);
    let group = groups.find((g) => g.key === dayKey);
    if (!group) {
      group = {
        key: dayKey,
        dayLabel: dayLabelVi(item.occurred_at),
        dateLabel: formatDateViShort(item.occurred_at),
        data: [],
        count: 0,
        income: 0,
        expense: 0,
        currency: undefined,
        collapsed: collapsedDays.has(dayKey),
      };
      groups.push(group);
    }

    const itemCurrency = walletCurrencyMap.get(item.wallet_id);
    const runningIncome = group.income;
    const runningExpense = group.expense;
    if (runningIncome !== undefined && runningExpense !== undefined) {
      if (!itemCurrency || (group.count > 0 && itemCurrency !== group.currency)) {
        group.income = undefined;
        group.expense = undefined;
      } else {
        if (group.count === 0) group.currency = itemCurrency;
        group.income = item.type === "income" ? runningIncome + item.amount : runningIncome;
        group.expense = item.type === "expense" ? runningExpense + item.amount : runningExpense;
      }
    }

    group.count += 1;
    group.data.push(item);
  }

  // Rows are dropped only after every total has been accumulated, so a
  // collapsed day still shows what it's hiding — the whole point of being
  // able to collapse it.
  return groups.map((group) => (group.collapsed ? { ...group, data: [] } : group));
}
