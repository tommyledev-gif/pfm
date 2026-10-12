import { Pressable, Text, View } from "react-native";
import type { MutationStatus } from "@tanstack/react-query";
import Animated from "react-native-reanimated";

import { CheckIcon, UploadIcon } from "@/components/ui/Icon";
import { SlideSwap } from "@/components/ui/SlideSwap";
import { withAlpha } from "@/lib/color";
import { formatPercent } from "@/lib/percent";
import { radii, typography, createStyles, useColors } from "@/lib/theme";
import { useUploadProgress } from "@/lib/use-upload-progress";

export const UPLOAD_WAITING_LABEL = "Đang tải ảnh lên…";
const ICON_SIZE = 16;

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
 * An outline pill that becomes its own progress bar: the fill sweeps across
 * behind a percent, the label rolls to "Đang tải ảnh lên…" if the upload
 * outlasts the staged run, then to a check and `doneLabel`, then back.
 * Timing lives in useUploadProgress. Same shape as PillButton's outline.
 */
export function UploadButton({ status, label, doneLabel, onPress, disabled, testID }: UploadButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const upload = useUploadProgress(status);

  const textFor = (key: string) =>
    key === "progress" ? formatPercent(upload.percent) : key === "waiting" ? UPLOAD_WAITING_LABEL : key === "done" ? doneLabel : label;

  const renderSlot = (key: string) => (
    <View style={styles.content}>
      {key === "idle" ? <UploadIcon size={ICON_SIZE} color={colors.textPrimary} /> : null}
      {key === "done" ? <CheckIcon size={ICON_SIZE} color={colors.green} /> : null}
      <Text style={[styles.label, key === "progress" && styles.tabular]} numberOfLines={1}>
        {textFor(key)}
      </Text>
    </View>
  );

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || upload.busy}
      accessibilityRole="button"
      accessibilityLabel={textFor(upload.phase)}
      accessibilityState={{ disabled: disabled || upload.busy, busy: upload.busy }}
      style={({ pressed }) => [styles.base, disabled && !upload.busy && styles.disabled, pressed && styles.pressed]}
    >
      <Animated.View style={[styles.fill, upload.fillStyle]} />
      {/* Sized by the longest label, so the pill does not jump between states. */}
      <SlideSwap slotKey={upload.phase} renderSlot={renderSlot} sizer={renderSlot("waiting")} />
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  base: {
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
    overflow: "hidden",
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: withAlpha(colors.overlayBase, 0.18),
  },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: withAlpha(colors.green, 0.28) },
  content: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  tabular: { fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
}));
