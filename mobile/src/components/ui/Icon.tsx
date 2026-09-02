import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

// Minimal inline SVG icon set — mirrors the design handoff's "no icon font,
// all icons are minimal inline SVGs (rects/circles/simple line paths)"
// approach (mobile/design_handoff_pfm_app/README.md, "Assets"), redrawn for
// react-native-svg rather than copied from the prototype's own runtime.
export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const base = (size = 20) => ({ width: size, height: size, viewBox: "0 0 24 24" });

export function HomeIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M4 11.5 12 4l8 7.5M6 10v9h12v-9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ListIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Line x1="8" y1="7" x2="20" y2="7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="8" y1="12" x2="20" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="8" y1="17" x2="20" y2="17" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="4.5" cy="7" r="1.4" fill={color} />
      <Circle cx="4.5" cy="12" r="1.4" fill={color} />
      <Circle cx="4.5" cy="17" r="1.4" fill={color} />
    </Svg>
  );
}

export function BarChartIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Rect x="5" y="12" width="3.4" height="8" rx="1" fill={color} />
      <Rect x="10.3" y="7" width="3.4" height="13" rx="1" fill={color} />
      <Rect x="15.6" y="10" width="3.4" height="10" rx="1" fill={color} />
    </Svg>
  );
}

export function UserIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Circle cx="12" cy="8.2" r="3.4" stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M4.8 19.5c1.2-3.4 4-5 7.2-5s6 1.6 7.2 5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SparkleIcon({ size, color = "#7EEBC0" }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.7l-1.6-5.5-5.4-1.6 5.4-1.6L12 3.5Z"
        fill={color}
      />
    </Svg>
  );
}

export function BellIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M6 10.5a6 6 0 1 1 12 0c0 4 1.4 5.4 1.4 5.4H4.6S6 14.5 6 10.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Path d="M10.2 19a1.9 1.9 0 0 0 3.6 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronLeftIcon({ size, color = "#fff", strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M15 5.5 8 12l7 6.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size, color = "#fff", strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M9 5.5 16 12l-7 6.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SendIcon({ size, color = "#06130A" }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M4 12 20 4l-6.5 16-2.5-6.5L4 12Z" fill={color} />
    </Svg>
  );
}

export function PlusIcon({ size, color = "#06130A", strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function EditIcon({ size, color = "#06130A", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M15.2 4.8 19.2 8.8 8.6 19.4 4 20l.6-4.6 10.6-10.6Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CheckIcon({ size, color = "#06130A", strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M4.5 12.5 9 17l10.5-11" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function WalletIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Rect x="3.5" y="6" width="17" height="12" rx="2.5" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M14.5 12.3h3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function TagIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="m11 4 8 8-7 7-8-8V4h7Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
      <Circle cx="8.2" cy="7.2" r="1" fill={color} />
    </Svg>
  );
}

export function UsersIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Circle cx="9" cy="8" r="3" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M3.5 19c.9-3 3-4.6 5.5-4.6s4.6 1.6 5.5 4.6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M15 5.3c1.4.4 2.4 1.6 2.4 3s-1 2.6-2.4 3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M17 14.7c1.9.5 3.2 1.9 3.7 4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function ShieldIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path
        d="M12 3.5 19 6v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-2.5Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HelpIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Circle cx="12" cy="12" r="8.2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M9.8 9.6a2.3 2.3 0 1 1 3.4 2c-.9.5-1.2.9-1.2 1.9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx="12" cy="16.6" r="0.9" fill={color} />
    </Svg>
  );
}

export function CalendarIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Rect x="4" y="5.5" width="16" height="14.5" rx="2" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M4 9.5h16M8 3.5v3M16 3.5v3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function TrashIcon({ size, color = "#FF9E96", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M5 7h14M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M7 7l1 12.5a1 1 0 0 0 1 .9h6a1 1 0 0 0 1-.9L17 7"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LogOutIcon({ size, color = "#FF9E96", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M9 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M13 8l4 4-4 4M9.5 12h7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SearchIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={strokeWidth} />
      <Line x1="15.3" y1="15.3" x2="20" y2="20" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function EyeIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <Circle cx="12" cy="12" r="2.8" stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function SortIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M7 4v16M7 20l-3.5-3.5M7 20l3.5-3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M17 20V4M17 4l-3.5 3.5M17 4l3.5 3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size, color = "#06130A", strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg {...base(size)} fill="none">
      <Path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

export function EyeOffIcon({ size, color = "#fff", strokeWidth = 2 }: IconProps) {
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
