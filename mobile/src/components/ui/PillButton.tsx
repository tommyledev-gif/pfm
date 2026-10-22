import { ReactNode, useState } from "react";
import { ActivityIndicator, Pressable, StyleProp, Text, TextStyle, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { RippleLayer, useRipple } from "@/components/motion/Ripple";
import { usePressScale } from "@/components/motion/use-press-scale";
import { withAlpha } from "@/lib/color";
import { radii, typography, createStyles, useColors } from "@/lib/theme";

// How far a singleLine label may shrink before it is cut off instead.
const SINGLE_LINE_MIN_SCALE = 0.8;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PillButtonProps {
  label?: string;
  icon?: ReactNode;
  onPress?: () => void;
  // Lets a caller (e.g. TransactionActionCard's Confirm button) react to a
  // long-press the same way its enclosing card does — without this, holding
  // directly on the button never bubbles up to an ancestor Pressable's own
  // onLongPress, since RN's gesture responder system hands the touch to the
  // innermost touchable and never passes long-press gestures back up.
  onLongPress?: () => void;
  delayLongPress?: number;
  variant?: "solid" | "outline";
  /** "end" puts the icon after the label, for an arrow that says "next". */
  iconPosition?: "start" | "end";
  /**
   * Keeps the label on one line, shrinking it a little when it would not
   * fit. For buttons sharing a row (ConfirmDialog), where a wrapped label
   * makes one button taller than its neighbour.
   */
  singleLine?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

// The app's one action-button primitive (form Save/Create, chat's Confirm &
// Save, dialog confirms) — one component so every screen renders the exact
// same pill shape/colors.
//
// The primary (solid) variant is neon-green-filled with near-black text, NOT
// the reverse. It used to be the reverse — a near-black (`colors.onGreen`,
// #06130A) pill with green text — which came from the design handoff's hero
// card, where the button genuinely sat *on* a neon-green surface. Every
// other use site is a dark surface (`colors.surface` #12161F inside a
// Drawer, a chat bubble, a dialog card), where a near-black fill was almost
// invisible: the primary action read as a disabled/ghost element. Green fill
// also matches every other primary affordance already in the app (chat send
// button, the `+` add buttons, the active SegmentedTabs tab).
//
// The secondary (outline) variant gets a faint filled background rather than
// full transparency for the same reason — a border-only shape on a dark
// sheet reads as decoration, not as a tappable button.
//
// A press dips the pill (usePressScale) instead of dimming it: dimmed, a
// green button looked for a moment like the disabled one. Reduce Motion keeps
// the dim. Not PressableScale: its style writes opacity, which would undo
// the disabled look.
export function PillButton({
  label,
  icon,
  onPress,
  onLongPress,
  delayLongPress,
  variant = "solid",
  iconPosition = "start",
  singleLine = false,
  disabled,
  loading,
  style,
  textStyle,
  testID,
}: PillButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const isOutline = variant === "outline";
  const press = usePressScale();
  // A disc spreads from where the finger lands (animate-ui's ripple button).
  const ripple = useRipple();
  // Only tracked under Reduce Motion, where the press dims instead.
  const [dimmed, setDimmed] = useState(false);
  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onLayout={ripple.onLayout}
      onPressIn={(event) => {
        press.onPressIn();
        ripple.spawn(event);
        if (press.reduceMotion) setDimmed(true);
      }}
      onPressOut={() => {
        press.onPressOut();
        if (dimmed) setDimmed(false);
      }}
      disabled={disabled || loading}
      style={[
        styles.base,
        isOutline ? styles.outline : styles.solid,
        (disabled || loading) && styles.disabled,
        dimmed && styles.pressed,
        style,
        press.style,
      ]}
    >
      {/* First, so the label paints over it; the pill clips it to its shape. */}
      <RippleLayer {...ripple} color={isOutline ? colors.overlayBase : colors.onGreen} />
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.textPrimary : colors.onGreen} />
      ) : (
        <>
          {iconPosition === "start" ? icon : null}
          {label ? (
            <Text
              numberOfLines={singleLine ? 1 : undefined}
              adjustsFontSizeToFit={singleLine}
              minimumFontScale={singleLine ? SINGLE_LINE_MIN_SCALE : undefined}
              style={[styles.label, isOutline ? styles.outlineLabel : styles.solidLabel, textStyle]}
            >
              {label}
            </Text>
          ) : null}
          {iconPosition === "end" ? icon : null}
        </>
      )}
    </AnimatedPressable>
  );
}

const useStyles = createStyles((colors) => ({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
    // Keeps the press ripple inside the pill.
    overflow: "hidden",
  },
  solid: { backgroundColor: colors.green },
  outline: {
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: withAlpha(colors.overlayBase, 0.18),
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
  // textAlign + flexShrink, because a pill is often laid out with flex:1 in a
  // two-button row (ConfirmDialog): a label like "Đặt mặc định" wraps there,
  // and a wrapped Text block is centred as a block while its own lines stay
  // left-aligned inside it — which reads as the button's text being off-centre.
  label: { ...typography.body, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  solidLabel: { color: colors.onGreen },
  outlineLabel: { color: colors.textPrimary },
}));
