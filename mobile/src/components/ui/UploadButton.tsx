import { useState } from "react";
import { LayoutChangeEvent, Text, View } from "react-native";
import type { MutationStatus } from "@tanstack/react-query";
import Animated from "react-native-reanimated";

import { exit } from "@/components/motion/motion-tokens";
import { PressableScale } from "@/components/motion/PressableScale";
import { TrashIcon } from "@/components/ui/Icon";
import { SlideSwap } from "@/components/ui/SlideSwap";
import { UploadProgressBar, UploadWell, popIn } from "@/components/ui/upload-button-parts";
import { withAlpha } from "@/lib/color";
import { formatPercent } from "@/lib/percent";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useUploadProgress } from "@/lib/use-upload-progress";

export const UPLOAD_WAITING_LABEL = "Đang tải ảnh lên…";
const MIN_HEIGHT = 64;
const LINE_HEIGHT = 20;
const REMOVE_SIZE = 36;
const CARD_PAD_RIGHT = 10;
const BORDER_WIDTH = 1.5;

interface UploadButtonProps {
  /** The upload mutation's status; the card plays its run from this. */
  status: MutationStatus;
  label: string;
  /** Shown for a moment once the server has the file. */
  doneLabel: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  /** A muted line under the label while idle ("Tối đa 2 MB"). */
  hint?: string;
  /** A destructive action at the card's right edge: a trash button. */
  remove?: {
    /** Not drawn (the button is its icon); accessibilityLabel names it. */
    label?: string;
    accessibilityLabel: string;
    onPress: () => void;
    disabled?: boolean;
    testID?: string;
  };
}

/**
 * An upload card: a dashed zone with a tinted circle holding a cloud, the
 * label ("Đổi ảnh") and an optional hint, and, when there is something to
 * remove, a red trash button at its right edge. While the upload runs the
 * border turns solid, the hint gives way to a progress bar, and the label
 * rolls through the percent, "Đang tải ảnh lên…" if the server is slow, and
 * `doneLabel` with a check popping into the circle once it answers. Timing
 * lives in useUploadProgress.
 *
 * As wide as its longest label unless its container stretches it; either way
 * the run never changes its width.
 */
export function UploadButton({ status, label, doneLabel, onPress, disabled, testID, hint, remove }: UploadButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const upload = useUploadProgress(status);
  const [restingWidth, setRestingWidth] = useState<number | null>(null);
  const showRemove = Boolean(remove) && !upload.busy;
  const inactive = disabled || upload.busy;

  const textFor = (key: string) =>
    key === "progress" ? formatPercent(upload.percent) : key === "waiting" ? UPLOAD_WAITING_LABEL : key === "done" ? doneLabel : label;

  const renderSlot = (key: string) => (
    <Text
      style={[styles.title, key === "progress" && styles.tabular, key === "done" && styles.doneTitle]}
      numberOfLines={1}
    >
      {textFor(key)}
    </Text>
  );

  // One line tall and as wide as the longest label, so a card sized by its
  // content (no stretching container) still fits every label of the run.
  const sizer = (
    <View style={styles.sizer}>
      {[label, doneLabel, UPLOAD_WAITING_LABEL].map((text, i) => (
        <Text key={i} style={styles.title} numberOfLines={1}>
          {text}
        </Text>
      ))}
    </View>
  );

  // While the upload runs the trash and the hint give way to the bar; a card
  // sized by its content would shrink, so it holds the width it had at rest.
  const onLayout = (event: LayoutChangeEvent) => {
    if (!upload.busy) setRestingWidth(event.nativeEvent.layout.width);
  };

  return (
    <View style={upload.busy && restingWidth ? { width: restingWidth } : null} onLayout={onLayout}>
      {/* Dimmed out here: PressableScale's own opacity would override it. */}
      <View style={disabled && !upload.busy ? styles.disabled : undefined}>
        <PressableScale
          testID={testID}
          onPress={onPress}
          disabled={inactive}
          accessibilityRole="button"
          accessibilityLabel={textFor(upload.phase)}
          accessibilityHint={upload.busy ? undefined : hint}
          accessibilityState={{ disabled: inactive, busy: upload.busy }}
          style={[
            styles.card,
            upload.busy ? styles.cardBusy : styles.cardIdle,
            upload.phase === "done" && styles.cardDone,
          ]}
        >
          <UploadWell phase={upload.phase} />
          <View style={[styles.body, showRemove && styles.bodyBesideRemove]}>
            <SlideSwap slotKey={upload.phase} renderSlot={renderSlot} sizer={sizer} align="start" />
            {upload.busy ? (
              <UploadProgressBar progress={upload.progress} />
            ) : hint ? (
              <Text style={styles.hint} numberOfLines={1}>
                {hint}
              </Text>
            ) : null}
          </View>
        </PressableScale>
      </View>

      {/* A sibling over the card's right edge, not a child: a button inside
          the card's button would be merged into it for screen readers. */}
      {showRemove && remove ? (
        <Animated.View entering={popIn()} exiting={exit("zoom")} style={styles.removeSlot} pointerEvents="box-none">
          <View style={remove.disabled ? styles.disabled : undefined}>
            <PressableScale
              testID={remove.testID}
              onPress={remove.onPress}
              disabled={remove.disabled}
              hitSlop={6}
              scaleTo={0.9}
              accessibilityRole="button"
              accessibilityLabel={remove.accessibilityLabel}
              accessibilityState={{ disabled: Boolean(remove.disabled) }}
              style={styles.remove}
            >
              <TrashIcon size={18} color={colors.danger} />
            </PressableScale>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    minHeight: MIN_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: CARD_PAD_RIGHT,
    borderRadius: radii.listCard,
    borderWidth: BORDER_WIDTH,
    backgroundColor: withAlpha(colors.green, 0.06),
  },
  // Dashed while it waits for a file, solid once one is on its way.
  cardIdle: { borderStyle: "dashed", borderColor: withAlpha(colors.green, 0.45) },
  cardBusy: { borderStyle: "solid", borderColor: withAlpha(colors.green, 0.3) },
  cardDone: { borderColor: withAlpha(colors.green, 0.6) },
  body: { flex: 1, justifyContent: "center", gap: 6 },
  // Room for the trash button laid over the card.
  bodyBesideRemove: { marginRight: REMOVE_SIZE + spacing.sm },
  title: { flexShrink: 1, fontSize: 14, fontWeight: "700", lineHeight: LINE_HEIGHT, color: colors.textPrimary },
  doneTitle: { color: colors.green },
  tabular: { fontVariant: ["tabular-nums"] },
  sizer: { height: LINE_HEIGHT, overflow: "hidden" },
  hint: { ...typography.caption, fontWeight: "500", color: colors.textSecondary },
  removeSlot: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: CARD_PAD_RIGHT + BORDER_WIDTH,
    justifyContent: "center",
  },
  remove: {
    width: REMOVE_SIZE,
    height: REMOVE_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.danger, 0.12),
  },
  disabled: { opacity: 0.45 },
}));
