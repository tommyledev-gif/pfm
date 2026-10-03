import { base, Circle, IconProps, Line, Path, Svg } from "@/components/ui/icons/primitives";
import { colors } from "@/lib/theme";

export function SearchIcon({ size, color = colors.textPrimary, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="15.3" y1="15.3" x2="20" y2="20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function EyeIcon({ size, color = colors.textPrimary, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="2.8" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function SortIcon({ size, color = colors.textPrimary, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M7 4v16M7 20l-3.5-3.5M7 20l3.5-3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17 20V4M17 4l-3.5 3.5M17 4l3.5 3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size, color = colors.onGreen, strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function HistoryIcon({ size, color = colors.textPrimary, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M3 12a9 9 0 1 0 2.6-6.3M3 4v4.5h4.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 8v4.5l3 2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CodeIcon({ size, color = colors.textPrimary, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M8.5 8 4.5 12l4 4M15.5 8l4 4-4 4M13.5 6.5l-3 11"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A bug — the debug console (DebugBubble). Shape adapted from Lucide's "bug" (ISC). */
export function BugIcon({ size, color = colors.textPrimary, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M8 2l1.9 1.9M14.1 3.9 16 2M9 7.1v-1a3 3 0 1 1 6 0v1M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6M12 20v-9M6.5 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M21 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function EyeOffIcon({ size, color = colors.textPrimary, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M4 4l16 16M9.6 9.7a2.8 2.8 0 0 0 3.9 3.9M6.3 6.7C3.9 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1.1M17.8 15.2C20.1 13.6 21.5 12 21.5 12S18 5.5 12 5.5c-.7 0-1.3.1-1.9.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Export/import (specs/transaction-export-import) — a tray with an arrow, the
// arrow's direction carrying the whole distinction: up and out of the tray
// for export, down and into it for import. Deliberately one shape in two
// mirrorings rather than two unrelated glyphs, since they sit side by side.
export function UploadIcon({ size, color = colors.textPrimary, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M12 15.5V4M8 7.5 12 3.5l4 4M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DownloadIcon({ size, color = colors.textPrimary, strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M12 3.5V15M8 11l4 4 4-4M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
