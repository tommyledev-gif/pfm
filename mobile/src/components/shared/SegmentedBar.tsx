import { Pressable, View } from "react-native";

import { createStyles } from "@/lib/theme";

export interface BarSegment {
  key: string;
  // Share of the whole bar, 0..1. Callers pass shares rather than raw amounts
  // so the bar never has to know what a xu is, and so a caller that wants the
  // buffer excluded from the denominator can say so without a second prop.
  share: number;
  color: string;
  // Draws the segment as a hatched, unfilled block instead of a solid one —
  // used for the wizard's buffer, which is money that exists but has no
  // category behind it. Solid-colouring it would make it look like a seventh
  // spending category, which is the one thing it must not look like.
  hatched?: boolean;
}

interface SegmentedBarProps {
  segments: BarSegment[];
  height?: number;
  /** Makes each block its own tap target. Without it the bar is a readout the
   *  user can see but not interrogate — the colours say a proportion without
   *  ever saying whose. */
  onPressSegment?: (key: string) => void;
  /** The block currently being explained; every other one dims so the answer
   *  and the question are unmistakably about the same block. */
  activeKey?: string | null;
}

const STRIPE_COUNT = 10;
// Gap between neighbouring blocks. `gap` on a flex row (RN 0.71+) rather than
// per-segment margins, so the first and last blocks still sit flush against
// the bar's rounded ends.
const SEGMENT_GAP = 2;

// One horizontal bar split into hard-edged coloured blocks — the allocation
// readout for the budget wizard's proposal screen.
//
// Deliberately NOT the same component as BudgetProgressBar: that one answers
// "how far through one budget am I", with a pace marker and an overspend tail.
// This one answers "how is the whole disposable amount divided", where nothing
// is spent yet and every block is a plan. Merging them would mean a component
// with two mutually exclusive halves.
export function SegmentedBar({ segments, height = 8, onPressSegment, activeKey }: SegmentedBarProps) {
  const styles = useStyles();
  // Fully rounded ends, same derivation as BudgetProgressBar — the two bars
  // appear on adjacent screens and a different corner treatment reads as a
  // mistake rather than a distinction.
  const radius = height / 2;

  return (
    <View style={[styles.track, { height, borderRadius: radius }]}>
      {segments.map((seg) => {
        const dimmed = activeKey != null && activeKey !== seg.key;
        return (
          <Pressable
            key={seg.key}
            testID={`segment-${seg.key}`}
            onPress={onPressSegment ? () => onPressSegment(seg.key) : undefined}
            disabled={!onPressSegment}
            // A tall hit area on a bar only 8px high — the block is the target
            // the user aims at, not the pixels it happens to paint.
            hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }}
            style={[
              styles.segment,
              // flexGrow carries the share instead of a percentage width: with
              // a gap between blocks, percentages sum past 100% and the last
              // block gets clipped. Flex distributes what is left after gaps.
              { flexGrow: Math.max(seg.share, 0), backgroundColor: seg.hatched ? "transparent" : seg.color },
              seg.hatched && styles.hatched,
              dimmed && styles.segmentDimmed,
            ]}
          >
            {seg.hatched
              ? Array.from({ length: STRIPE_COUNT }).map((_, i) => <View key={i} style={styles.stripe} />)
              : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  track: {
    width: "100%",
    flexDirection: "row",
    gap: SEGMENT_GAP,
    overflow: "hidden",
    backgroundColor: colors.bgApp,
  },
  segment: { flexBasis: 0, flexShrink: 1, overflow: "hidden" },
  segmentDimmed: { opacity: 0.32 },
  hatched: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  stripe: {
    width: 1,
    height: "220%",
    backgroundColor: colors.textMuted,
    transform: [{ rotate: "30deg" }],
  },
}));
