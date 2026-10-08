import { BarSegment } from "@/components/shared/SegmentedBar";
import { SegmentLegendEntry } from "@/features/budget-wizard/components/SegmentLegend";
import { BudgetProposalsResponse, ProposalEntry } from "@/features/budget-wizard/types";
import { colors } from "@/lib/theme";

/** The unallocated remainder's segment. Not a category, and never treated as
 *  one — it is drawn hatched and named as a remainder, because colouring it
 *  like the others would make it look like one more spending line to raid. */
export const BUFFER_SEGMENT_KEY = "__buffer__";

/**
 * The allocation bar's blocks, in the order the rows are listed.
 *
 * Shares are of `disposable`, so the buffer and the categories are measured
 * against the same denominator and the blocks sum to the whole bar.
 */
export function buildProposalSegments(
  result: BudgetProposalsResponse,
  ordered: ProposalEntry[],
  colorFor: (categoryId: string) => string,
): BarSegment[] {
  const segments: BarSegment[] = ordered.map((p) => ({
    key: p.category_id,
    share: result.disposable > 0 ? p.amount_max / result.disposable : 0,
    color: colorFor(p.category_id),
  }));

  if (result.unallocated_amount > 0) {
    segments.push({
      key: BUFFER_SEGMENT_KEY,
      share: result.disposable > 0 ? result.unallocated_amount / result.disposable : 0,
      color: colors.surfaceBorder,
      hatched: true,
    });
  }

  return segments;
}

/** What the tapped block is, or null when nothing is selected. */
export function segmentLegendEntry(
  result: BudgetProposalsResponse,
  ordered: ProposalEntry[],
  colorFor: (categoryId: string) => string,
  activeKey: string | null,
): SegmentLegendEntry | null {
  if (!activeKey) return null;
  const share = (amount: number) => (result.disposable > 0 ? amount / result.disposable : 0);

  if (activeKey === BUFFER_SEGMENT_KEY) {
    return {
      key: BUFFER_SEGMENT_KEY,
      name: "Dự phòng (chưa thuộc mục nào)",
      color: colors.surfaceBorder,
      amount: result.unallocated_amount,
      share: share(result.unallocated_amount),
    };
  }

  const entry = ordered.find((p) => p.category_id === activeKey);
  if (!entry) return null;
  return {
    key: entry.category_id,
    name: entry.category_name,
    color: colorFor(entry.category_id),
    amount: entry.amount_max,
    share: share(entry.amount_max),
  };
}
