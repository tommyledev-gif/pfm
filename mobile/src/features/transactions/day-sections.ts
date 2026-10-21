import { dayLabelVi, formatDateViShort } from "@/lib/format-date";
import { Transaction } from "@/features/transactions/types";
import { mainCurrency } from "@/features/transactions/other-currencies";

export interface DaySection {
  key: string;
  dayLabel: string;
  dateLabel: string;
  // Empty while the day is collapsed: a folded day is laid out exactly like a
  // day with no rows. While it is still *folding* the rows stay, shrinking to
  // zero height in DayFoldRow, and are dropped only once that has played
  // (useCollapsedDays). Each row carries its own spacing inside that
  // shrinking box, so a row at zero height leaves no gap behind.
  data: Transaction[];
  // Full row count regardless of collapse, so a collapsed day can still say
  // how much it is hiding.
  count: number;
  // Income and expense are kept apart rather than netted: a day with both
  // reads as "+2.000.000 / -350.000", which is the actual question being
  // asked of a day header, where a single net figure hides half of it.
  //
  // In ONE currency only: a day that mixes them (a multi-wallet day) shows
  // its main one (VND when present) and names the rest in otherCurrencies —
  // a subtotal that added VND cents to USD cents would be the "never sum
  // incompatible currencies" bug wallet-totals.ts/budget-totals.ts guard
  // against. Undefined only while a row's wallet (so its currency) is unknown.
  income: number | undefined;
  expense: number | undefined;
  currency: string | undefined;
  otherCurrencies: string[];
  /** Folded, or folding: what the header shows. */
  collapsed: boolean;
  /** Folding right now: its rows are still in `data`, shrinking away. */
  folding: boolean;
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
  collapsedDays: ReadonlySet<string>;
  foldingDays: ReadonlySet<string>;
}

// Splits an already-sorted transaction list into the SectionList sections the
// Transactions screen renders, accumulating each day's income/expense subtotal
// as it goes. Pure — the screen wraps it in a useMemo.
export function buildDaySections(
  items: Transaction[],
  { grouped, walletCurrencyMap, collapsedDays, foldingDays }: BuildDaySectionsOptions,
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
        otherCurrencies: [],
        collapsed: false,
        folding: false,
      },
    ];
  }

  const groups: DaySection[] = [];
  // Per day: each currency's own income/expense, and whether any row's
  // currency is unknown (its wallet not loaded yet).
  const sums = new Map<string, { byCurrency: Map<string, { income: number; expense: number }>; unknown: boolean }>();
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
        income: undefined,
        expense: undefined,
        currency: undefined,
        otherCurrencies: [],
        collapsed: collapsedDays.has(dayKey) || foldingDays.has(dayKey),
        folding: foldingDays.has(dayKey),
      };
      groups.push(group);
      sums.set(dayKey, { byCurrency: new Map(), unknown: false });
    }

    const day = sums.get(dayKey)!;
    const itemCurrency = walletCurrencyMap.get(item.wallet_id);
    if (!itemCurrency) {
      day.unknown = true;
    } else {
      const running = day.byCurrency.get(itemCurrency) ?? { income: 0, expense: 0 };
      if (item.type === "income") running.income += item.amount;
      if (item.type === "expense") running.expense += item.amount;
      day.byCurrency.set(itemCurrency, running);
    }

    group.count += 1;
    group.data.push(item);
  }

  for (const group of groups) {
    const day = sums.get(group.key)!;
    if (day.unknown) continue;
    const currencies = [...day.byCurrency.keys()];
    const main = mainCurrency(currencies);
    if (!main) continue;
    const totals = day.byCurrency.get(main)!;
    group.currency = main;
    group.income = totals.income;
    group.expense = totals.expense;
    group.otherCurrencies = currencies.filter((c) => c !== main);
  }

  // After the loop, not instead of the push: count and the subtotals above
  // still cover every row, so a folded day says what it is hiding.
  return groups.map((g) => (g.collapsed && !g.folding ? { ...g, data: [] } : g));
}
