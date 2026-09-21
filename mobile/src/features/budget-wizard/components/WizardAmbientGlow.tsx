import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import { colors } from "@/lib/theme";

// Each blob's centre as a fraction of the layer, its radius as a fraction of
// the layer's width, and its peak opacity. Positioned to land in the gaps
// *between* the option rows rather than behind their text — the point is depth
// in the negative space, not a tint over the content.
const BLOBS = [
  { id: "cool", cx: 0.12, cy: 0.16, r: 0.58, color: colors.periwinkle, opacity: 0.16 },
  { id: "violet", cx: 0.92, cy: 0.46, r: 0.52, color: colors.lavender, opacity: 0.14 },
  { id: "warm", cx: 0.28, cy: 0.88, r: 0.5, color: colors.peach, opacity: 0.12 },
] as const;

/**
 * Three soft radial glows behind the wizard's profile step.
 *
 * ⚠️ Radial gradients, not a full-screen gradient wash. A wash tints every
 * pixel including the text, flattens the surfaces it covers, and is the single
 * most over-used background treatment there is — it reads as decoration
 * applied to a screen rather than as light in a space. These are three small,
 * offset pools of colour at 12–16% peaking in the gaps between rows, so the
 * depth is felt without anything competing with what the user is reading.
 *
 * Genuine radial falloff via react-native-svg (already a dependency) rather
 * than a translucent circle View, which would have a hard edge no amount of
 * border radius can soften.
 */
export function WizardAmbientGlow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {BLOBS.map((blob) => (
            <RadialGradient key={blob.id} id={blob.id} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={blob.color} stopOpacity={blob.opacity} />
              {/* A mid stop keeps the falloff from looking like a ring: a
                  straight two-stop ramp reads as a visible edge partway out. */}
              <Stop offset="55%" stopColor={blob.color} stopOpacity={blob.opacity * 0.35} />
              <Stop offset="100%" stopColor={blob.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {BLOBS.map((blob) => (
          <Circle
            key={blob.id}
            cx={`${blob.cx * 100}%`}
            cy={`${blob.cy * 100}%`}
            r={`${blob.r * 100}%`}
            fill={`url(#${blob.id})`}
          />
        ))}
      </Svg>
    </View>
  );
}
