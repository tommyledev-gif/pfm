import { useEffect, useState } from "react";
import { BackHandler, LayoutChangeEvent, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { formatCurrency } from "@/lib/currency";
import { amountInWordsVi } from "@/lib/number-to-words-vi";
import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { TooltipContent, useTooltipStore } from "@/stores/tooltip-store";

const SCREEN_MARGIN = spacing.lg;
// Space between the target and the bubble; the arrow sits in it.
const ANCHOR_GAP = 12;
const ARROW_SIZE = 12;
// Below this, a bubble placed above would run under the status bar.
const MIN_TOP = 48;
const MAX_WIDTH = 300;
const FADE_MS = 140;
// A hint goes by itself; an amount stays until tapped away.
const HINT_VISIBLE_MS = 2500;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * The app's one tooltip (useTooltipStore): a bubble pointing at the element
 * that was held, above it when there is room, below it otherwise, nudged
 * inside the screen edges. An amount spells itself out in full and in words
 * over a dimmed screen; a hint is a few words, no dim, gone on its own.
 *
 * ⚠️ In-tree at the app root, not a <Modal>. A Modal is its own Android
 * window: it opened with a frame of window animation and a layout pass at
 * the wrong height before the bubble settled, which read as a sheet sliding
 * up behind the tooltip (2026-10-24). Here it is one more view over the
 * screen, faded in on the UI thread, in the same page coordinates `measure()`
 * reports on an edge-to-edge app.
 */
export function TooltipHost() {
  const styles = useStyles();
  const window = useWindowDimensions();
  const anchor = useTooltipStore((s) => s.anchor);
  const content = useTooltipStore((s) => s.content);
  const token = useTooltipStore((s) => s.token);
  const hide = useTooltipStore((s) => s.hide);
  const [size, setSize] = useState<{ token: number; width: number; height: number } | null>(null);
  const open = anchor !== null && content !== null;

  useEffect(() => {
    if (!open) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      hide();
      return true;
    });
    const timer = content.kind === "hint" ? setTimeout(hide, HINT_VISIBLE_MS) : null;
    return () => {
      back.remove();
      if (timer) clearTimeout(timer);
    };
  }, [open, content, hide]);

  if (!open) return null;

  const measured = size?.token === token ? size : null;
  const onBubbleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ token, width, height });
  };

  // Laid out invisibly first: the bubble's own size decides where it fits.
  let placement: { top: number; left: number; arrowLeft: number; above: boolean } | null = null;
  if (measured) {
    const above = anchor.y - ANCHOR_GAP - measured.height >= MIN_TOP;
    const anchorCentreX = anchor.x + anchor.width / 2;
    const left = clamp(anchorCentreX - measured.width / 2, SCREEN_MARGIN, window.width - SCREEN_MARGIN - measured.width);
    placement = {
      above,
      top: above ? anchor.y - ANCHOR_GAP - measured.height : anchor.y + anchor.height + ANCHOR_GAP,
      left,
      // Still points at the target's centre when the bubble itself had to be
      // pushed off-centre by a screen edge.
      arrowLeft: clamp(anchorCentreX - left - ARROW_SIZE / 2, radii.listCard, measured.width - radii.listCard - ARROW_SIZE),
    };
  }

  const maxWidth = { maxWidth: Math.min(MAX_WIDTH, window.width - SCREEN_MARGIN * 2) };
  const dim = content.kind === "amount";

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={hide} testID="tooltip-backdrop">
        {dim ? <Animated.View entering={FadeIn.duration(FADE_MS)} style={[StyleSheet.absoluteFill, styles.dim]} /> : null}
      </Pressable>
      {placement ? (
        <Animated.View
          key={token}
          entering={FadeIn.duration(FADE_MS)}
          pointerEvents="none"
          style={[styles.bubble, maxWidth, { top: placement.top, left: placement.left }]}
          testID={content.kind === "amount" ? "amount-tooltip" : "hint-tooltip"}
        >
          <TooltipBody content={content} />
          <View style={[styles.arrow, placement.above ? styles.arrowDown : styles.arrowUp, { left: placement.arrowLeft }]} />
        </Animated.View>
      ) : (
        <View
          key={token}
          onLayout={onBubbleLayout}
          pointerEvents="none"
          style={[styles.bubble, maxWidth, styles.measuring]}
        >
          <TooltipBody content={content} />
        </View>
      )}
    </View>
  );
}

function TooltipBody({ content }: { content: TooltipContent }) {
  const styles = useStyles();
  if (content.kind === "hint") return <Text style={styles.hint}>{content.text}</Text>;
  return (
    <>
      {content.label ? <Text style={styles.label}>{content.label}</Text> : null}
      <Text style={styles.amount}>{formatCurrency(content.amountCents, content.currency)}</Text>
      <Text style={styles.words}>{amountInWordsVi(content.amountCents, content.currency)}</Text>
    </>
  );
}

const useStyles = createStyles((colors) => ({
  dim: { backgroundColor: "rgba(0,0,0,0.35)" },
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
  hint: { ...typography.caption, color: colors.textPrimary, textAlign: "center" },
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
