import { Circle, IconProps, Path, Rect, Svg, base } from "@/components/ui/icons/primitives";
import { colors } from "@/lib/theme";

// Utility glyphs for message actions and settings — plain line-art at the
// set's usual stroke weight, no fills.

/** Two stacked sheets — copy to clipboard. */
export function CopyIcon({ size, color = colors.textPrimary, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Rect x="8.5" y="8.5" width="12" height="12" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** A push pin — a phrase the user chose to keep. */
export function PinIcon({ size, color = colors.textPrimary, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M9 3.5h6l-1 5.5 3.5 3v1.5h-11V12L10 9 9 3.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M12 13.5v7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** A painter's palette — appearance / theme. */
export function PaletteIcon({ size, color = colors.textPrimary, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7h2.1a3.9 3.9 0 0 0 3.9-3.9C20.5 7 16.7 3.5 12 3.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx="7.5" cy="11.5" r="1.1" fill={color} />
      <Circle cx="10" cy="7.5" r="1.1" fill={color} />
      <Circle cx="14.5" cy="7.5" r="1.1" fill={color} />
    </Svg>
  );
}

/** A map marker — where a transaction was made. */
export function MapPinIcon({ size, color = colors.textPrimary, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="10" r="2.5" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

/** A padlock — a step that opens once the one before it is done. */
export function LockIcon({ size, color = colors.textPrimary, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Rect x="5" y="10.5" width="14" height="10" rx="2.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/** A columned building — a bank account, any money source. */
export function BankIcon({ size, color = colors.textPrimary, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M3.5 9 12 4l8.5 5h-17Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Path
        d="M6 9.5v7M10 9.5v7M14 9.5v7M18 9.5v7M3.5 20h17"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
