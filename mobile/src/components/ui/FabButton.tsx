import { ReactNode, useId } from "react";
import { AccessibilityState, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { PressableScale } from "@/components/motion/PressableScale";
import { RippleLayer, useRipple } from "@/components/motion/Ripple";
import { withAlpha } from "@/lib/color";
import { radii, createStyles, useColors } from "@/lib/theme";

export const FAB_SIZE = 56;
// A press dips it further than a row: it is the screen's one big target.
export const FAB_PRESS_SCALE = 0.92;
// The ring around the disc: a hairline of the primary, then a gap of the
// screen's own colour.
const RING_LINE = 1;
const RING_GAP = 3;
const RING = RING_LINE + RING_GAP;

interface FabButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityState?: AccessibilityState;
  testID?: string;
  /** The icon, centred on the disc. */
  children: ReactNode;
}

/**
 * The round primary button itself, shared by Fab and ExpandableFab: a disc
 * of the primary, lit from above, set in a ring.
 *
 * ⚠️ The ring is what keeps it apart from what it floats over. A plain green
 * disc with a green glow melted into the green cards and buttons it passed
 * over (the Wallets screen's own cards, a green progress bar). The ring's gap
 * is the screen's background colour, so over anything at all the disc sits
 * in a cut-out of its own; on the bare background only the hairline shows,
 * as a faint orbit. The shadow is a plain dark one: a green glow over green
 * is no edge. The light from above and the shade at the foot make it read as
 * a raised button, not a sticker on the content.
 *
 * Takes the ring outside its own place (negative margin), so swapping it in
 * moved no button and no list clearance (useFabClearance) by a pixel.
 */
export function FabButton({ onPress, accessibilityLabel, accessibilityState, testID, children }: FabButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const ripple = useRipple();
  // Unique per button on screen; useId's colons are not valid inside url(#…).
  const lightId = `fab-light-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onPress={onPress}
      onPressIn={ripple.spawn}
      hitSlop={8}
      scaleTo={FAB_PRESS_SCALE}
      style={styles.ring}
    >
      <View pointerEvents="none" style={styles.disc} onLayout={ripple.onLayout}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={lightId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.34} />
              <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0.16} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${lightId})`} />
        </Svg>
        <RippleLayer {...ripple} color={colors.onGreen} />
        {children}
      </View>
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  ring: {
    width: FAB_SIZE + RING * 2,
    height: FAB_SIZE + RING * 2,
    margin: -RING,
    borderRadius: radii.pill,
    borderWidth: RING_LINE,
    borderColor: withAlpha(colors.green, 0.35),
    backgroundColor: colors.bgApp,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  // Clips the light and the ripple to the circle.
  disc: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
}));
