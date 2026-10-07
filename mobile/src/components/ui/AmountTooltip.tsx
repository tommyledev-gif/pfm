import { useState } from "react";
import { Dimensions, LayoutChangeEvent, Modal, Pressable, Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { amountInWordsVi } from "@/lib/number-to-words-vi";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

/** A target's box in screen coordinates — `measure()`'s pageX/pageY plus its size. */
export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AmountTooltipProps {
  visible: boolean;
  anchor: AnchorRect | null;
  amountCents: number;
  currency: string;
  /** What the figure is ("Tài sản ròng") — repeated as the bubble's heading. */
  label?: string;
  onClose: () => void;
}

const SCREEN_MARGIN = spacing.lg;
// Space between the target and the bubble; the arrow sits in it.
const ANCHOR_GAP = 12;
const ARROW_SIZE = 12;
// Below this, a bubble placed above would run under the status bar.
const MIN_TOP = 48;
const MAX_WIDTH = 300;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * The exact amount behind a shortened one, in a bubble pointing at the figure
 * that was held — above it when there is room, below it otherwise, nudged
 * inside the screen edges. Spells the amount out in words too, like
 * AmountRevealPopup, the centred variant other screens still use.
 *
 * In a transparent Modal so it paints over everything and any tap outside
 * dismisses it. statusBarTranslucent/navigationBarTranslucent make the Modal
 * span the whole screen — the same space the anchor's page coordinates are in
 * on an edge-to-edge app — instead of starting below the status bar.
 */
export function AmountTooltip({ visible, anchor, amountCents, currency, label, onClose }: AmountTooltipProps) {
  const styles = useStyles();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const window = Dimensions.get("window");

  const onBubbleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
  };

  // Laid out invisibly first: the bubble's own size decides where it fits.
  let placement: { top: number; left: number; arrowLeft: number; above: boolean } | null = null;
  if (anchor && size) {
    const above = anchor.y - ANCHOR_GAP - size.height >= MIN_TOP;
    const anchorCentreX = anchor.x + anchor.width / 2;
    const left = clamp(anchorCentreX - size.width / 2, SCREEN_MARGIN, window.width - SCREEN_MARGIN - size.width);
    placement = {
      above,
      top: above ? anchor.y - ANCHOR_GAP - size.height : anchor.y + anchor.height + ANCHOR_GAP,
      left,
      // Still points at the target's centre when the bubble itself had to be
      // pushed off-centre by a screen edge.
      arrowLeft: clamp(anchorCentreX - left - ARROW_SIZE / 2, radii.listCard, size.width - radii.listCard - ARROW_SIZE),
    };
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} testID="amount-tooltip-backdrop">
        <View
          onLayout={onBubbleLayout}
          style={[
            styles.bubble,
            { maxWidth: Math.min(MAX_WIDTH, window.width - SCREEN_MARGIN * 2) },
            placement ? { top: placement.top, left: placement.left } : styles.measuring,
          ]}
          testID="amount-tooltip"
        >
          {label ? <Text style={styles.label}>{label}</Text> : null}
          <Text style={styles.amount} selectable>
            {formatCurrency(amountCents, currency)}
          </Text>
          <Text style={styles.words}>{amountInWordsVi(amountCents, currency)}</Text>
          {placement ? (
            <View
              style={[
                styles.arrow,
                placement.above ? styles.arrowDown : styles.arrowUp,
                { left: placement.arrowLeft },
              ]}
            />
          ) : null}
        </View>
      </Pressable>
    </Modal>
  );
}

const useStyles = createStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  bubble: {
    position: "absolute",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: 2,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  // Off-screen while its size is not yet known — measured, never seen misplaced.
  measuring: { top: 0, left: 0, opacity: 0 },
  label: { ...typography.tiny, color: colors.textSecondary },
  amount: { ...typography.cardTitle, color: colors.textPrimary, textAlign: "center" },
  words: { ...typography.tiny, color: colors.textMuted, textAlign: "center" },
  // A square turned 45°, bordered on its two outer sides only, so it reads as
  // a notch of the bubble's own border. Half of it overlaps the bubble, which
  // hides the bubble's border line where the two meet.
  arrow: {
    position: "absolute",
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    transform: [{ rotate: "45deg" }],
  },
  arrowDown: { bottom: -ARROW_SIZE / 2, borderRightWidth: 1, borderBottomWidth: 1 },
  arrowUp: { top: -ARROW_SIZE / 2, borderLeftWidth: 1, borderTopWidth: 1 },
}));
