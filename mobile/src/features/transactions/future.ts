import { Transaction } from "@/features/transactions/types";

/**
 * Splits a transaction list into "today or earlier" and "dated ahead of today".
 *
 * ⚠️ Why this exists at all: the list is ordered `occurred_at DESC`, so a
 * transaction someone books for next month sits ABOVE today's — the top of the
 * list stops being "what just happened" and becomes "what I once scheduled".
 * That is the single most-read strip of the screen, and a row that has not
 * happened yet has no business occupying it.
 *
 * Future rows are not dropped: the screen shows them behind a dashed card whose
 * count says exactly how many there are. Hiding them outright would make a
 * transaction the user definitely created appear to have not saved.
 *
 * Comparison is by LOCAL calendar day, not by timestamp — a transaction
 * occurring at 11pm tonight is still today's, and `new Date(iso) > new Date()`
 * would file it as future for the rest of the evening.
 */
export function splitFutureTransactions(
  items: Transaction[],
  now: Date = new Date(),
): { future: Transaction[]; upToToday: Transaction[] } {
  const todayKey = localDayKey(now);
  const future: Transaction[] = [];
  const upToToday: Transaction[] = [];

  for (const item of items) {
    if (localDayKey(new Date(item.occurred_at)) > todayKey) future.push(item);
    else upToToday.push(item);
  }

  // Soonest first, unlike the main list: "what is coming up" is read forwards.
  // The farthest-out row is the least useful one and belongs at the bottom.
  future.sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());

  return { future, upToToday };
}

/** YYYY-MM-DD in the device's own timezone — lexicographically comparable. */
function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Whether the screen's active date filter is itself reaching into the future.
 *
 * A user who filtered to "next month" asked for those rows and must see them
 * inline — pulling them behind the dashed card would leave an empty list under
 * a filter that matched plenty. Only an unfiltered view (or one bounded at
 * today or earlier) hides them.
 */
export function rangeTargetsFuture(to: string | undefined, now: Date = new Date()): boolean {
  if (!to) return false;
  return to.slice(0, 10) > localDayKey(now);
}
