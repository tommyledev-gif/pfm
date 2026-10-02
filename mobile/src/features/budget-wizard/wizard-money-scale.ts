import { SliderScale } from "@/components/ui/MoneySlider";
import { INCOME_CAP_XU } from "@/features/budget-wizard/budget-math";

interface Segment {
  /** Where on the track (0..1) this segment ends. */
  untilRatio: number;
  /** The amount (xu) at that point. */
  untilXu: number;
  /** Snap step inside this segment, xu. */
  stepXu: number;
}

// The wizard's money track runs 0 → 10 tỷ, but almost every income sits under
// 50tr, so that range keeps the first 60% of the track and its old 100.000đ
// step — the slider feels exactly as it did when 50tr was its end. The last
// 40% then covers 50tr → 1 tỷ → 10 tỷ in coarser, still-round steps. Typing
// stays exact at any size; this only decides what a drag lands on.
const SEGMENTS: Segment[] = [
  { untilRatio: 0.6, untilXu: 50_000_000_00, stepXu: 100_000_00 },
  { untilRatio: 0.8, untilXu: 1_000_000_000_00, stepXu: 5_000_000_00 },
  { untilRatio: 1, untilXu: INCOME_CAP_XU, stepXu: 50_000_000_00 },
];

export const WIZARD_MONEY_MAX_XU = INCOME_CAP_XU;

function segmentFor(predicate: (s: Segment) => boolean): { segment: Segment; fromRatio: number; fromXu: number } {
  let fromRatio = 0;
  let fromXu = 0;
  for (const segment of SEGMENTS) {
    if (predicate(segment)) return { segment, fromRatio, fromXu };
    fromRatio = segment.untilRatio;
    fromXu = segment.untilXu;
  }
  const last = SEGMENTS[SEGMENTS.length - 1];
  const beforeLast = SEGMENTS[SEGMENTS.length - 2];
  return { segment: last, fromRatio: beforeLast.untilRatio, fromXu: beforeLast.untilXu };
}

export const WIZARD_MONEY_SCALE: SliderScale = {
  toRatio: (value) => {
    const { segment, fromRatio, fromXu } = segmentFor((s) => value <= s.untilXu);
    const share = (value - fromXu) / (segment.untilXu - fromXu);
    return fromRatio + Math.min(Math.max(share, 0), 1) * (segment.untilRatio - fromRatio);
  },
  fromRatio: (ratio) => {
    const { segment, fromRatio, fromXu } = segmentFor((s) => ratio <= s.untilRatio);
    const share = (ratio - fromRatio) / (segment.untilRatio - fromRatio);
    return fromXu + share * (segment.untilXu - fromXu);
  },
  stepAt: (value) => segmentFor((s) => value <= s.untilXu).segment.stepXu,
};
