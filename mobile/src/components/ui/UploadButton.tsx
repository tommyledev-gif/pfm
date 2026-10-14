import { useState } from "react";
import { LayoutChangeEvent, Pressable, Text, View } from "react-native";
import type { MutationStatus } from "@tanstack/react-query";

import { CheckIcon, TrashIcon, UploadIcon } from "@/components/ui/Icon";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SlideSwap } from "@/components/ui/SlideSwap";
import { withAlpha } from "@/lib/color";
import { formatPercent } from "@/lib/percent";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useUploadProgress } from "@/lib/use-upload-progress";

export const UPLOAD_WAITING_LABEL = "Đang tải ảnh lên…";
const GLYPH_SIZE = 18;
const RING_STROKE = 2.25;
const MIN_HEIGHT = 48;

interface UploadButtonProps {
  /** The upload mutation's status; the button plays its run from this. */
  status: MutationStatus;
  label: string;
  /** Shown for a moment once the server has the file. */
  doneLabel: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  /** A second, destructive action in the same bar ("Xóa"), behind a divider. */
  remove?: {
    label: string;
    accessibilityLabel: string;
    onPress: () => void;
    disabled?: boolean;
    testID?: string;
  };
}

/**
 * One bordered bar: "Đổi ảnh" with an upload icon, and, when there is
 * something to remove, a divider and a red "Xóa". While the upload runs, the
 * upload half takes the whole bar (held at its resting width, so nothing
 * jumps): a progress ring and the percent, "Đang tải ảnh lên…" if the server
 * is slow, a check and `doneLabel` once it answers. Timing lives in
 * useUploadProgress.
 */
export function UploadButton({ status, label, doneLabel, onPress, disabled, testID, remove }: UploadButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const upload = useUploadProgress(status);
  const [restingWidth, setRestingWidth] = useState<number | null>(null);
  const showRemove = Boolean(remove) && !upload.busy;

  const textFor = (key: string) =>
    key === "progress" ? formatPercent(upload.percent) : key === "waiting" ? UPLOAD_WAITING_LABEL : key === "done" ? doneLabel : label;

  const glyphFor = (key: string) => {
    if (key === "idle") return <UploadIcon size={GLYPH_SIZE} color={colors.green} />;
    if (key === "done") return <CheckIcon size={GLYPH_SIZE} color={colors.green} strokeWidth={2.6} />;
    return (
      <ProgressRing
        progress={upload.progress}
        size={GLYPH_SIZE}
        strokeWidth={RING_STROKE}
        color={colors.green}
        trackColor={withAlpha(colors.green, 0.25)}
      />
    );
  };

  const renderSlot = (key: string) => (
    <View style={styles.content}>
      {glyphFor(key)}
      <Text style={[styles.label, key === "progress" && styles.tabular]} numberOfLines={1}>
        {textFor(key)}
      </Text>
    </View>
  );

  // The resting width is what the busy bar keeps. A bar with no "Xóa" next to
  // it has no room to give, so it is sized by its longest label instead.
  const onLayout = (event: LayoutChangeEvent) => {
    if (!upload.busy) setRestingWidth(event.nativeEvent.layout.width);
  };
  const sizer = renderSlot(remove && !upload.busy ? "idle" : "waiting");
  const inactive = disabled || upload.busy;

  return (
    <View style={[styles.bar, remove && upload.busy && restingWidth ? { width: restingWidth } : null]} onLayout={onLayout}>
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={textFor(upload.phase)}
        accessibilityState={{ disabled: inactive, busy: upload.busy }}
        style={({ pressed }) => [
          styles.segment,
          upload.busy && styles.segmentFull,
          disabled && !upload.busy && styles.disabled,
          pressed && styles.pressed,
        ]}
      >
        <SlideSwap slotKey={upload.phase} renderSlot={renderSlot} sizer={sizer} />
      </Pressable>
      {showRemove && remove ? (
        <>
          <View style={styles.divider} />
          <Pressable
            testID={remove.testID}
            onPress={remove.onPress}
            disabled={remove.disabled}
            accessibilityRole="button"
            accessibilityLabel={remove.accessibilityLabel}
            accessibilityState={{ disabled: Boolean(remove.disabled) }}
            style={({ pressed }) => [styles.segment, remove.disabled && styles.disabled, pressed && styles.pressed]}
          >
            <View style={styles.content}>
              <TrashIcon size={GLYPH_SIZE} color={colors.danger} />
              <Text style={[styles.label, styles.removeLabel]} numberOfLines={1}>
                {remove.label}
              </Text>
            </View>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  bar: {
    minHeight: MIN_HEIGHT,
    flexDirection: "row",
    alignItems: "stretch",
    alignSelf: "flex-start",
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: withAlpha(colors.overlayBase, 0.08),
    overflow: "hidden",
  },
  segment: { justifyContent: "center", paddingHorizontal: spacing.lg },
  segmentFull: { flex: 1, alignItems: "center" },
  divider: { width: 1, marginVertical: spacing.md, backgroundColor: withAlpha(colors.overlayBase, 0.16) },
  content: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { ...typography.body, color: colors.textPrimary },
  removeLabel: { color: colors.danger },
  tabular: { fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
}));
