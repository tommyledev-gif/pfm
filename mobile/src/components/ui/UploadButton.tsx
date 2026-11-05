import { useRef, useState } from "react";
import { LayoutChangeEvent, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { MutationStatus } from "@tanstack/react-query";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { exit } from "@/components/motion/motion-tokens";
import { PressableScale } from "@/components/motion/PressableScale";
import { TrashIcon } from "@/components/ui/Icon";
import { SlideSwap } from "@/components/ui/SlideSwap";
import { UploadDoneCheck, UploadProgressBar, UploadWell, popIn } from "@/components/ui/upload-button-parts";
import { withAlpha } from "@/lib/color";
import { formatPercent } from "@/lib/percent";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useUploadProgress } from "@/lib/use-upload-progress";

export const UPLOAD_WAITING_KEY = "ui.upload.waiting" as const;
const MIN_HEIGHT = 64;
const LINE_HEIGHT = 20;
const REMOVE_SIZE = 36;
const CARD_PAD_RIGHT = 10;
const BORDER_WIDTH = 1.5;
// The card's contents giving way to the check, and coming back after it.
const CONTENT_OUT_MS = 160;
const CONTENT_IN_MS = 220;

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
 * rolls through the percent and "Đang tải ảnh lên…" if the server is slow.
 * Once it answers, the contents fade out and a check pops in alone in the
 * middle of the card; then the contents (and the trash) come back. Timing
 * lives in useUploadProgress. `doneLabel` is what a screen reader says then.
 *
 * As wide as its longest label unless its container stretches it; either way
 * the run never changes its width.
 */
export function UploadButton({ status, label, doneLabel, onPress, disabled, testID, hint, remove }: UploadButtonProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const upload = useUploadProgress(status);
  const [resting, setResting] = useState<{ width: number; height: number } | null>(null);
  const showRemove = Boolean(remove) && !upload.busy;
  const inactive = disabled || upload.busy;
  const done = upload.phase === "done";
  // The contents fade back in only after a check: on the screen's first
  // frame they are simply there.
  const afterDone = useRef(false);
  if (done) afterDone.current = true;
  const contentIn = afterDone.current ? FadeIn.duration(CONTENT_IN_MS) : undefined;
  const contentOut = FadeOut.duration(CONTENT_OUT_MS);

  const textFor = (key: string) =>
    key === "progress" ? formatPercent(upload.percent) : key === "waiting" ? t(UPLOAD_WAITING_KEY) : key === "done" ? doneLabel : label;

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
  // Not doneLabel: it is never drawn.
  const sizer = (
    <View style={styles.sizer}>
      {[label, t(UPLOAD_WAITING_KEY)].map((text, i) => (
        <Text key={i} style={styles.title} numberOfLines={1}>
          {text}
        </Text>
      ))}
    </View>
  );

  // While the upload runs the trash and the hint give way to the bar, and the
  // check stands in for all of it; a card sized by its content would shrink,
  // so it holds the size it had at rest.
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!upload.busy) setResting({ width, height });
  };
  const held = upload.busy ? resting : null;

  return (
    <View style={held ? { width: held.width } : null} onLayout={onLayout}>
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
            held ? { minHeight: held.height } : null,
            upload.busy ? styles.cardBusy : styles.cardIdle,
            done && styles.cardDone,
          ]}
        >
          {/* Unmounted for the check, so it comes back fresh: the label
              reads "Đổi ảnh" at once instead of rolling over from "100%". The
              card keeps its size meanwhile (`held`). */}
          {/* ⚠️ The well and the body stay the card's own children, each fading
              on its own. Wrapped together in one flexing row, the card (sized
              by its content on the profile screen) measured that row at zero
              and collapsed to its padding (seen on the emulator). */}
          {done ? null : (
            <Animated.View entering={contentIn} exiting={contentOut}>
              <UploadWell phase={upload.phase} />
            </Animated.View>
          )}
          {done ? null : (
            <Animated.View
              entering={contentIn}
              exiting={contentOut}
              style={[styles.body, showRemove && styles.bodyBesideRemove]}
            >
              <SlideSwap slotKey={upload.phase} renderSlot={renderSlot} sizer={sizer} align="start" />
              {upload.busy ? (
                <UploadProgressBar progress={upload.progress} />
              ) : hint ? (
                <Text style={styles.hint} numberOfLines={1}>
                  {hint}
                </Text>
              ) : null}
            </Animated.View>
          )}
          {done ? <UploadDoneCheck /> : null}
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
