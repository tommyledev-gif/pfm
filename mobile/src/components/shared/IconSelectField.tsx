import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { MutationStatus } from "@tanstack/react-query";
import Animated from "react-native-reanimated";

import { Avatar } from "@/components/ui/Avatar";
import { ChevronRightIcon } from "@/components/ui/Icon";
import { SlideSwap } from "@/components/ui/SlideSwap";
import { UPLOAD_WAITING_LABEL } from "@/components/ui/UploadButton";
import { findOpenMoji } from "@/lib/openmoji";
import { withAlpha } from "@/lib/color";
import { formatPercent } from "@/lib/percent";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useUploadProgress } from "@/lib/use-upload-progress";

interface IconSelectFieldProps {
  name: string;
  color: string;
  icon: string;
  iconUrl?: string;
  /** The photo upload mutation's status: the row plays the upload run from it. */
  uploadStatus: MutationStatus;
  onPress: () => void;
}

// The form row for a record's icon: a preview of what is set now and what it
// is, tapping through to the picker panel (use-icon-picker). The picker closes
// before the photo upload starts, so this row is where the upload shows: it
// fills like UploadButton, behind a percent that rolls to "Đang tải ảnh lên…"
// and then back to the description once the new photo is in.
export function IconSelectField({ name, color, icon, iconUrl, uploadStatus, onPress }: IconSelectFieldProps) {
  const colors = useColors();
  const styles = useStyles();
  const upload = useUploadProgress(uploadStatus);
  const uploading = upload.phase === "progress" || upload.phase === "waiting";
  const description = iconUrl
    ? "Ảnh đã tải lên"
    : icon
      ? findOpenMoji(icon)?.annotation ?? icon
      : "Biểu tượng mặc định";

  // "done" shares the resting slot: the new photo in the preview says it.
  const slotKey = uploading ? upload.phase : "rest";
  const renderSlot = (key: string) => (
    <Text style={[styles.value, key === "progress" && styles.tabular]} numberOfLines={1}>
      {key === "progress" ? formatPercent(upload.percent) : key === "waiting" ? UPLOAD_WAITING_LABEL : description}
    </Text>
  );

  return (
    <Pressable style={styles.row} onPress={onPress} disabled={upload.busy} testID="field-icon-select">
      <Animated.View style={[styles.fill, upload.fillStyle]} />
      <View style={styles.preview}>
        {uploading ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : (
          <Avatar name={name || "?"} color={color} size={44} icon={icon} iconUrl={iconUrl} />
        )}
      </View>
      <View style={styles.textCol}>
        <SlideSwap slotKey={slotKey} renderSlot={renderSlot} sizer={renderSlot("rest")} align="start" />
        <Text style={styles.hint}>Chạm để chọn emoji hoặc tải ảnh</Text>
      </View>
      <ChevronRightIcon size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.listCard,
    overflow: "hidden",
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: withAlpha(colors.green, 0.16) },
  preview: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  textCol: { flex: 1, minWidth: 0, gap: 2 },
  value: { ...typography.body, color: colors.textPrimary, flexShrink: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
  hint: { ...typography.tiny, color: colors.textMuted },
}));
