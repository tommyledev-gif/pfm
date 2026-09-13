import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

// Shared props and viewBox helper for the whole icon set.
//
// The set lives in icons/*.tsx and is re-exported by components/ui/Icon.tsx,
// which every call site still imports from. It was one file until it crossed
// CLAUDE.md's 300-line cap; splitting it by nothing more interesting than
// "where the file got too long" is deliberate — these are 30 unrelated
// glyphs with no natural grouping, and inventing categories would only make
// people guess which file a given icon is in.
export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const base = (size = 20) => ({ width: size, height: size, viewBox: "0 0 24 24" });

export { Svg, Circle, Line, Path, Rect };
