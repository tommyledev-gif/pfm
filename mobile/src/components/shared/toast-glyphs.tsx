import { Circle, Line, Path, Svg, base } from "@/components/ui/icons/primitives";
import type { Palette } from "@/lib/theme";
import type { ToastVariant } from "@/stores/toast-store";

/** The colour that carries a toast's variant: its badge, well and action line. */
export function toastAccent(variant: ToastVariant, colors: Palette): string {
  switch (variant) {
    case "error":
      return colors.error;
    case "warning":
      return colors.warning;
    case "success":
      return colors.green;
    case "info":
    default:
      return colors.info;
  }
}

interface ToastGlyphProps {
  variant: ToastVariant;
  size: number;
  color: string;
}

// Drawn here rather than taken from the icon set: inside a 22 px badge the
// set's outlined circle-glyphs ("i" in a ring) read as a smudge. A bare mark,
// one stroke weight for all four, is what the badge has room for.
const STROKE = 3;

/** The mark inside a toast's badge: "!" for error and warning, "i" for info, a check for success. */
export function ToastGlyph({ variant, size, color }: ToastGlyphProps) {
  if (variant === "success") {
    return (
      <Svg {...base(size)} fill="none">
        <Path d="M5.5 12.5l4.2 4.2L18.5 8" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  if (variant === "info") {
    return (
      <Svg {...base(size)} fill="none">
        <Circle cx={12} cy={6.5} r={1.9} fill={color} />
        <Line x1={12} y1={11} x2={12} y2={18} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      </Svg>
    );
  }
  return (
    <Svg {...base(size)} fill="none">
      <Line x1={12} y1={6} x2={12} y2={13} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Circle cx={12} cy={17.8} r={1.9} fill={color} />
    </Svg>
  );
}
