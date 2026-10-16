// Ring geometry for DonutChart: where each segment sits and the SVG arc that
// draws it. Split out of DonutChart.tsx to keep that file under 300 lines.

// Arc length, in px, carved off the end of every segment so neighbours read as
// separate blocks instead of one continuous gradient. The gap is a real hole in
// the stroke — the app background shows through it — which is why it reads as
// black without painting anything black: a drawn divider would need its own
// color, and that color would be wrong the moment this chart is placed on a
// card instead of the screen.
export const SEGMENT_GAP = 4;
// Shortest arc, in px along the ring and gap included, a non-zero segment is
// laid out with. A 80.000 ₫ slice beside 396.000.000 ₫ is 0.02% of the ring,
// well under a pixel: it vanished, and only the gap carved off its big
// neighbour stayed, an empty notch where the small ones should have been.
export const MIN_SEGMENT_ARC = SEGMENT_GAP + 8;

export function polarToPoint(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Each segment's arc length around the ring. Proportional to its amount,
 * except that every non-zero segment gets at least MIN_SEGMENT_ARC, taken back
 * from the segments above the floor in proportion to their size — so the
 * ring still closes and the big ones keep their relative sizes. Only the
 * drawing is floored: percentages and the tooltip use the real amounts.
 */
export function layoutArcLengths(amounts: number[], circumference: number): number[] {
  const total = amounts.reduce((sum, a) => sum + a, 0);
  if (total <= 0) return amounts.map(() => 0);
  const raw = amounts.map((a) => (a / total) * circumference);
  const nonZero = amounts.filter((a) => a > 0).length;
  if (nonZero <= 1) return raw;
  // Never more than half the ring between them, however many small ones.
  const floor = Math.min(MIN_SEGMENT_ARC, circumference / nonZero / 2);
  const isSmall = (length: number) => length > 0 && length < floor;
  const borrowed = raw.reduce((sum, length) => sum + (isSmall(length) ? floor - length : 0), 0);
  const largeTotal = raw.reduce((sum, length) => sum + (isSmall(length) ? 0 : length), 0);
  return raw.map((length) => {
    if (length === 0) return 0;
    if (isSmall(length)) return floor;
    return length - (largeTotal > 0 ? borrowed * (length / largeTotal) : 0);
  });
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
