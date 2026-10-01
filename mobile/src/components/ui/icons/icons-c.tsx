import { useId } from "react";
import { Defs, LinearGradient, Stop } from "react-native-svg";

import { Circle, IconProps, Line, Path, Svg, base } from "@/components/ui/icons/primitives";

// Chat-mode glyphs (features/ai-chat/chat-mode.ts) — each one says what its
// mode is FOR rather than being a generic shape: a receipt for recording, a
// target for budgeting, a chart-plus-lightbulb for analysis. Line-art at the
// set's usual stroke weight, with a soft tinted fill on the one shape that
// carries the idea.

// SVG gradient ids must be unique on screen — the same icon renders in the
// header and in the picker at once. useId's colons are not valid in url(#…).
function useGradientId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
}

/** Ghi giao dịch — a receipt with a "+" badge. */
export function ReceiptIcon({ size, color = "#fff", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M16 11V4.5A1.5 1.5 0 0 0 14.5 3h-8A1.5 1.5 0 0 0 5 4.5V21l2-1.3 2 1.3 2-1.3 1.2.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="7.8" y1="8" x2="13.2" y2="8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="7.8" y1="11.5" x2="11.5" y2="11.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="17.2" cy="17.2" r="4.3" fill={color} fillOpacity={0.18} stroke={color} strokeWidth={strokeWidth} />
      <Line x1="17.2" y1="15.2" x2="17.2" y2="19.2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="15.2" y1="17.2" x2="19.2" y2="17.2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** Lập ngân sách — a target with an arrow in its centre. */
export function TargetIcon({ size, color = "#fff", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Circle cx="11" cy="13" r="8" stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="11" cy="13" r="4.6" fill={color} fillOpacity={0.2} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx="11" cy="13" r="1.4" fill={color} />
      <Path d="M11 13 19.5 4.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path
        d="M16.6 4.2 19.5 4.5l.3 2.9M18.6 3.2 21 3l-.2 2.4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface InsightIconProps extends IconProps {
  /** Second gradient stop; `color` is the first. Omit for a flat icon. */
  toColor?: string;
}

/** Hỏi phân tích — rising bars with a lightbulb: AI insight on your data. */
export function InsightIcon({ size, color = "#fff", toColor, strokeWidth = 1.8 }: InsightIconProps) {
  const gradientId = useGradientId("insight");
  const paint = toColor ? `url(#${gradientId})` : color;
  return (
    <Svg {...base(size)} fill="none">
      {toColor ? (
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={color} />
            <Stop offset="1" stopColor={toColor} />
          </LinearGradient>
        </Defs>
      ) : null}
      <Line x1="3.5" y1="20.5" x2="20.5" y2="20.5" stroke={paint} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M6 20.5v-4.5M10 20.5v-7" stroke={paint} strokeWidth={strokeWidth + 0.8} strokeLinecap="round" />
      {/* The bulb sits where the third bar would peak. */}
      <Path
        d="M16.5 3.5a4 4 0 0 0-2.4 7.2c.5.4.8.9.8 1.5v.6h3.2v-.6c0-.6.3-1.1.8-1.5a4 4 0 0 0-2.4-7.2Z"
        fill={paint}
        fillOpacity={0.22}
        stroke={paint}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Line x1="15.2" y1="15.4" x2="17.8" y2="15.4" stroke={paint} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M16.5 17v3.5" stroke={paint} strokeWidth={strokeWidth + 0.8} strokeLinecap="round" />
    </Svg>
  );
}

/** A small check inside a filled circle — the "selected" mark. */
export function CheckCircleIcon({ size, color = "#85FF33", checkColor = "#06130A" }: IconProps & { checkColor?: string }) {
  return (
    <Svg {...base(size)} fill="none">
      <Circle cx="12" cy="12" r="10" fill={color} />
      <Path d="M7.5 12.3 10.6 15.3 16.6 9" stroke={checkColor} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** The keypad's delete-last key: a left-pointing key cap with an ×. */
export function BackspaceIcon({ size, color = "#F5F6F8", strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7 6-7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="m11.5 9.5 5 5m0-5-5 5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}
