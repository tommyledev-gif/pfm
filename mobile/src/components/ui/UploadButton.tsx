import { Pressable, Text, View } from "react-native";
import type { MutationStatus } from "@tanstack/react-query";

import { CheckIcon, UploadIcon } from "@/components/ui/Icon";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { SlideSwap } from "@/components/ui/SlideSwap";
import { withAlpha } from "@/lib/color";
import { formatPercent } from "@/lib/percent";
import { radii, typography, createStyles, useColors } from "@/lib/theme";
import { useUploadProgress } from "@/lib/use-upload-progress";

export const UPLOAD_WAITING_LABEL = "Đang tải ảnh lên…";
const GLYPH_SIZE = 18;
const RING_STROKE = 2.25;
// Apple's minimum touch target.
const MIN_HEIGHT = 44;

interface UploadButtonProps {
  /** The upload mutation's status; the button plays its run from this. */
  status: MutationStatus;
  label: string;
  /** Shown for a moment once the server has the file. */
  doneLabel: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

/**
 * A tinted capsule (iOS's "tinted" button: the accent at low alpha behind
 * accent text, no border). While uploading, the leading glyph becomes a
 * progress ring beside the percent, the label rolls to "Đang tải ảnh lên…"
 * if the server is slow, ends on 100%, then a filled check and `doneLabel`.
 * Timing lives in useUploadProgress.
 */
export function UploadButton({ status, label, doneLabel, onPress, disabled, testID }: UploadButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const upload = useUploadProgress(status);

  const textFor = (key: string) =>
    key === "progress" ? formatPercent(upload.percent) : key === "waiting" ? UPLOAD_WAITING_LABEL : key === "done" ? doneLabel : label;

  const glyphFor = (key: string) => {
    if (key === "idle") return <UploadIcon size={GLYPH_SIZE} color={colors.green} />;
    if (key === "done") {
      return (
        <View style={styles.doneBadge}>
          <CheckIcon size={12} color={colors.onGreen} strokeWidth={3} />
        </View>
      );
    }
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

  const inactive = disabled || upload.busy;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={textFor(upload.phase)}
      accessibilityState={{ disabled: inactive, busy: upload.busy }}
      style={({ pressed }) => [styles.base, disabled && !upload.busy && styles.disabled, pressed && styles.pressed]}
    >
      {/* Sized by the longest label, so the capsule does not jump between states. */}
      <SlideSwap slotKey={upload.phase} renderSlot={renderSlot} sizer={renderSlot("waiting")} />
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  base: {
    minHeight: MIN_HEIGHT,
    justifyContent: "center",
    borderRadius: radii.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: withAlpha(colors.green, 0.14),
  },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { ...typography.body, color: colors.green, letterSpacing: -0.2 },
  tabular: { fontVariant: ["tabular-nums"] },
  doneBadge: {
    width: GLYPH_SIZE,
    height: GLYPH_SIZE,
    borderRadius: GLYPH_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
  },
  // iOS dims a tinted button while it is held, with a slight press-in.
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
}));
