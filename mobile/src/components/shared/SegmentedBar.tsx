import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";

import { REDUCED_MOTION_MS, useReduceMotion } from "@/lib/motion";
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

// Hatch spacing, fixed in px so the pattern keeps one density at any width.
const STRIPE_SPACING = 5;
// Gap between neighbouring blocks. The first and last blocks still sit flush
// against the bar's rounded ends.
const SEGMENT_GAP = 2;
// ⚠️ A plain ease, never a spring. This bar is the wizard's readout of a
// proposal the user is deciding whether to trust; a bounce makes the
// proportions look unsettled, the opposite of what a figure should convey.
const RESIZE_MS = 220;
const DIM_MS = 120;
const DIMMED_OPACITY = 0.32;

interface BlockLayout {
  key: string;
  x: number;
  width: number;
}

/**
 * Where each block sits, in px, for a track `trackWidth` wide.
 *
 * Shares are normalised, the same distribution flexGrow used to give: gaps
 * come off the width first and the rest is split by share. A zero-share block
 * gets no gap of its own, so it cannot leave a double gap behind.
 */
export function layoutSegments(segments: BarSegment[], trackWidth: number, gap = SEGMENT_GAP): BlockLayout[] {
  const shares = segments.map((s) => (Number.isFinite(s.share) && s.share > 0 ? s.share : 0));
  const total = shares.reduce((sum, s) => sum + s, 0);
  const shown = shares.filter((s) => s > 0).length;
  const available = Math.max(0, trackWidth - gap * Math.max(0, shown - 1));
  let x = 0;
  return segments.map((seg, i) => {
    const width = total > 0 ? (shares[i] / total) * available : 0;
    const block = { key: seg.key, x, width };
    if (width > 0) x += width + gap;
    return block;
  });
}

// One horizontal bar split into hard-edged coloured blocks — the allocation
// readout for the budget wizard's proposal screen.
//
// Deliberately NOT the same component as BudgetProgressBar: that one answers
// "how far through one budget am I", with a pace marker and an overspend tail.
// This one answers "how is the whole disposable amount divided", where nothing
// is spent yet and every block is a plan. Merging them would mean a component
// with two mutually exclusive halves.
//
// MOTION: blocks move only when `segments` changes (an amount edited, a row
// added or removed) — never on mount. Both a block's position and its width
// run on the native driver, which cannot animate `left`/`width`, so each block
// is a track-wide clip slid to its x, holding a track-wide fill slid so its
// right edge lands at the block's width (see SegmentBlock). Nothing is scaled,
// so the hatch and its border keep their real thickness.
//
// Taps go to an invisible flex row laid over the bar at the TARGET layout,
// not to the moving blocks: a block mid-slide is not something to aim at.
export function SegmentedBar({ segments, height = 8, onPressSegment, activeKey }: SegmentedBarProps) {
  const styles = useStyles();
  // Fully rounded ends, same derivation as BudgetProgressBar — the two bars
  // appear on adjacent screens and a different corner treatment reads as a
  // mistake rather than a distinction.
  const radius = height / 2;
  const [trackWidth, setTrackWidth] = useState(0);
  const layout = useMemo(() => layoutSegments(segments, trackWidth), [segments, trackWidth]);
  // Blocks that mount after the bar's first measured render are additions and
  // grow in; the first set is simply there.
  const settled = useRef(false);
  const growNewBlocks = settled.current;
  useEffect(() => {
    if (trackWidth > 0) settled.current = true;
  }, [trackWidth]);

  return (
    <View
      style={[styles.root, { height }]}
      onLayout={(e) => {
        const next = e.nativeEvent.layout.width;
        setTrackWidth((prev) => (prev === next ? prev : next));
      }}
    >
      <View pointerEvents="none" style={[styles.track, { borderRadius: radius }]}>
        {trackWidth > 0
          ? segments.map((seg, i) => (
              <SegmentBlock
                key={seg.key}
                segment={seg}
                x={layout[i].x}
                width={layout[i].width}
                trackWidth={trackWidth}
                dimmed={activeKey != null && activeKey !== seg.key}
                growIn={growNewBlocks}
              />
            ))
          : null}
      </View>

      {onPressSegment ? (
        <View style={styles.hitRow}>
          {segments.map((seg) => (
            <Pressable
              key={seg.key}
              testID={`segment-${seg.key}`}
              onPress={() => onPressSegment(seg.key)}
              // A tall hit area on a bar only 8px high — the block is the
              // target the user aims at, not the pixels it happens to paint.
              hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }}
              style={[styles.hit, { flexGrow: Number.isFinite(seg.share) ? Math.max(seg.share, 0) : 0 }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface SegmentBlockProps {
  segment: BarSegment;
  x: number;
  width: number;
  trackWidth: number;
  dimmed: boolean;
  growIn: boolean;
}

function SegmentBlock({ segment, x, width, trackWidth, dimmed, growIn }: SegmentBlockProps) {
  const styles = useStyles();
  const reduceMotion = useReduceMotion();
  const xValue = useRef(new Animated.Value(x)).current;
  const widthValue = useRef(new Animated.Value(growIn ? 0 : width)).current;
  const opacity = useRef(new Animated.Value(dimmed ? DIMMED_OPACITY : 1)).current;
  const lastTrackWidth = useRef(trackWidth);

  useEffect(() => {
    // A re-measured track (rotation, a resized parent) is not a data change:
    // jump straight to the new geometry instead of animating the relayout.
    if (lastTrackWidth.current !== trackWidth) {
      lastTrackWidth.current = trackWidth;
      xValue.setValue(x);
      widthValue.setValue(width);
      return;
    }
    const move = (value: Animated.Value, toValue: number) =>
      Animated.timing(value, {
        toValue,
        duration: reduceMotion ? REDUCED_MOTION_MS : RESIZE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });
    const animation = Animated.parallel([move(xValue, x), move(widthValue, width)]);
    animation.start();
    return () => animation.stop();
  }, [x, width, trackWidth, reduceMotion, xValue, widthValue]);

  useEffect(() => {
    const fade = Animated.timing(opacity, {
      toValue: dimmed ? DIMMED_OPACITY : 1,
      duration: DIM_MS,
      useNativeDriver: true,
    });
    fade.start();
    return () => fade.stop();
  }, [dimmed, opacity]);

  // The fill is as wide as the track; sliding it left by (track − width)
  // leaves exactly `width` of it showing inside the clip.
  const fillX = useMemo(
    () => widthValue.interpolate({ inputRange: [0, trackWidth], outputRange: [-trackWidth, 0] }),
    [widthValue, trackWidth],
  );

  const stripeCount = segment.hatched ? Math.ceil(trackWidth / STRIPE_SPACING) : 0;

  return (
    <Animated.View
      style={[styles.blockClip, { width: trackWidth, opacity, transform: [{ translateX: xValue }] }]}
    >
      <Animated.View
        style={[
          styles.blockFill,
          { width: trackWidth, transform: [{ translateX: fillX }] },
          segment.hatched ? styles.hatched : { backgroundColor: segment.color },
        ]}
      >
        {Array.from({ length: stripeCount }).map((_, i) => (
          <View key={i} style={styles.stripe} />
        ))}
      </Animated.View>
      {/* The fill's own left border is slid out of the clip, so the hatch's
          left edge is drawn here, pinned to the block's x. */}
      {segment.hatched ? <View style={styles.hatchedLeftEdge} /> : null}
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  root: { width: "100%" },
  track: { ...StyleSheet.absoluteFillObject, overflow: "hidden", backgroundColor: colors.bgApp },
  blockClip: { position: "absolute", top: 0, bottom: 0, left: 0, overflow: "hidden" },
  blockFill: { position: "absolute", top: 0, bottom: 0, left: 0, overflow: "hidden" },
  hatched: {
    flexDirection: "row",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  hatchedLeftEdge: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 1,
    backgroundColor: colors.surfaceBorder,
  },
  stripe: {
    width: 1,
    height: "220%",
    marginRight: STRIPE_SPACING - 1,
    backgroundColor: colors.textMuted,
    transform: [{ rotate: "30deg" }],
  },
  // Same distribution as the drawn blocks (layoutSegments), via flex.
  hitRow: { ...StyleSheet.absoluteFillObject, flexDirection: "row", gap: SEGMENT_GAP },
  hit: { flexBasis: 0, flexShrink: 1 },
}));
