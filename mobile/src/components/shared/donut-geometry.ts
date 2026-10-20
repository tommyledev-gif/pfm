// Ring geometry for DonutChart: where each segment sits and the SVG arc that
// draws it. Split out of DonutChart.tsx to keep that file under 300 lines.

// Arc length, in px, carved off the end of every segment so neighbours read as
// separate blocks instead of one continuous gradient. The gap is a real hole in
// the stroke — the app background shows through it — which is why it reads as
// black without painting anything black: a drawn divider would need its own
// color, and that color would be wrong the moment this chart is placed on a
// card instead of the screen.
export const SEGMENT_GAP = 4;
// Below this share of the total a segment is drawn flush: no gap after it and
// none after the segment before it. A gap on a sliver only a few pixels long
// left mostly gap, so a run of small categories read as a dotted notch.
export const SMALL_SEGMENT_SHARE = 0.05;

export interface ArcLayout {
  /** Arc length along the ring, gap included — exactly the segment's share. */
  full: number;
  /** Under SMALL_SEGMENT_SHARE: drawn with no gap on either side. */
  small: boolean;
}

export function polarToPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Each segment's arc length around the ring: exactly its share of the total,
 * so a 1% category takes 1% of the ring.
 *
 * ⚠️ No minimum share. Small segments used to be raised to 3% of the ring (the
 * difference taken from the big ones), so a "~1%" category drew three times
 * its size and every large one drew smaller than its own percentage. A tiny
 * category may now be a sliver; its row in the legend is still there to tap.
 */
export function layoutArcLengths(amounts: number[], circumference: number): ArcLayout[] {
  const total = amounts.reduce((sum, a) => sum + a, 0);
  if (total <= 0) return amounts.map(() => ({ full: 0, small: false }));
  return amounts.map((a) => ({
    full: (a / total) * circumference,
    small: a > 0 && a / total < SMALL_SEGMENT_SHARE,
  }));
}

/**
 * What is carved off the end of each segment so it reads apart from the next.
 * None beside a small segment, on either side: neither after it nor after the
 * segment drawn just before it. Zero-amount segments draw nothing and are
 * skipped when finding a segment's neighbour, wrapping round the ring.
 */
export function segmentGaps(layout: ArcLayout[]): number[] {
  const drawn = layout.map((arc, index) => ({ arc, index })).filter(({ arc }) => arc.full > 0);
  const gaps = layout.map(() => 0);
  if (drawn.length <= 1) return gaps;
  drawn.forEach(({ arc, index }, position) => {
    const next = drawn[(position + 1) % drawn.length].arc;
    if (arc.small || next.small) return;
    gaps[index] = arc.full > SEGMENT_GAP * 2 ? SEGMENT_GAP : 0;
  });
  return gaps;
}

// One segment as its own open arc path, clockwise from 12 o'clock-based
// angles. Its own path (rather than a dash on a full circle) is what lets
// the entry animation reveal it with the standard "draw a line" trick: a
// dash exactly as long as the path, pulled in by strokeDashoffset. A full
// 360° sweep can't be one SVG arc command, so it is drawn as two halves.
export function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  if (sweepDeg >= 359.99) {
    const top = polarToPoint(cx, cy, r, startDeg);
    const bottom = polarToPoint(cx, cy, r, startDeg + 180);
    return `M ${top.x} ${top.y} A ${r} ${r} 0 1 1 ${bottom.x} ${bottom.y} A ${r} ${r} 0 1 1 ${top.x} ${top.y}`;
  }
  const start = polarToPoint(cx, cy, r, startDeg);
  const end = polarToPoint(cx, cy, r, startDeg + sweepDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}
