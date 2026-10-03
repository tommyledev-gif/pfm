import { useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleProp, Text, TextStyle, View, ViewStyle } from "react-native";

import { AmountTooltip, AnchorRect } from "@/components/ui/AmountTooltip";
import { formatCurrencyCompact } from "@/lib/currency";
import { createStyles } from "@/lib/theme";

// Longer than RN's ~500ms default. A figure is something the eye rests on, and
// at the default delay a slow tap on a stat card popped a modal the user never
// asked for. A full second is unmistakably a hold.
const REVEAL_DELAY_MS = 1000;

interface RevealableAmountProps {
  /** null renders `emptyLabel` and is not holdable — there is nothing to reveal. */
  amountCents: number | null;
  currency: string;
  /** The amount text's own style. */
  style?: StyleProp<TextStyle>;
  emptyLabel?: string;
  testID?: string;
  /** What the figure is — shown above it, and as the tooltip's heading. */
  label?: string;
  labelStyle?: StyleProp<TextStyle>;
  /** The hold target's look. Pass the whole card's style here: the card is
   *  what gets held, not just the line of text inside it. */
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * A compacted amount ("~7tr100k") that gives up the exact figure on a hold,
 * in a tooltip pointing back at it.
 *
 * The pairing is the point: compacting alone loses information, so anywhere an
 * amount is shortened to fit, the real number has to stay one gesture away —
 * the same contract TransactionRow already has with formatCurrencyTruncated.
 * This bundles the two so a caller cannot take the shortening without the way
 * back.
 *
 * ⚠️ The hold used to be reachable only on the amount's own line of text —
 * about 60×18 on a Settings stat card — so holding the card anywhere else,
 * label or padding, did nothing at all, with nothing on screen to say the
 * gesture even existed. The whole container is the target now, and a thin bar
 * fills along its bottom edge for the length of the hold, so the user can see
 * the hold registering and how long is left.
 */
export function RevealableAmount({
  amountCents,
  currency,
  style,
  emptyLabel = "—",
  testID,
  label,
  labelStyle,
  containerStyle,
}: RevealableAmountProps) {
  const styles = useStyles();
  const targetRef = useRef<View>(null);
  const holdProgress = useRef(new Animated.Value(0)).current;
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  const startHold = () => {
    holdProgress.setValue(0);
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: REVEAL_DELAY_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  };

  const endHold = () => {
    holdProgress.stopAnimation();
    Animated.timing(holdProgress, { toValue: 0, duration: 150, useNativeDriver: true }).start();
  };

  // ⚠️ measure()'s page coordinates, not measureInWindow: on Android
  // edge-to-edge, measureInWindow reports y below the status bar while the
  // tooltip's Modal spans the full screen, so the bubble landed a status bar's
  // height too high — on top of the very card it was pointing at.
  const reveal = () => {
    targetRef.current?.measure((_x, _y, width, height, pageX, pageY) =>
      setAnchor({ x: pageX, y: pageY, width, height }),
    );
  };

  const holdable = amountCents !== null;

  return (
    <>
      <Pressable
        ref={targetRef}
        style={[styles.target, containerStyle]}
        onPressIn={holdable ? startHold : undefined}
        onPressOut={holdable ? endHold : undefined}
        onLongPress={holdable ? reveal : undefined}
        delayLongPress={REVEAL_DELAY_MS}
        disabled={!holdable}
        accessibilityRole={holdable ? "button" : undefined}
        accessibilityLabel={label}
        accessibilityHint={holdable ? "Nhấn giữ để xem số tiền đầy đủ" : undefined}
        testID={testID}
      >
        {label ? (
          <Text style={labelStyle} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
        <Text style={style} numberOfLines={1}>
          {holdable ? formatCurrencyCompact(amountCents, currency) : emptyLabel}
        </Text>
        <Animated.View pointerEvents="none" style={[styles.holdBar, { transform: [{ scaleX: holdProgress }] }]} />
      </Pressable>

      {holdable ? (
        <AmountTooltip
          visible={anchor !== null}
          anchor={anchor}
          amountCents={amountCents}
          currency={currency}
          label={label}
          onClose={() => setAnchor(null)}
        />
      ) : null}
    </>
  );
}

const useStyles = createStyles((colors) => ({
  // Clips the hold bar to the container's rounded corners.
  target: { overflow: "hidden" },
  // Grows out from the middle as the hold progresses (scaleX 0 → 1).
  holdBar: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: colors.green },
}));
