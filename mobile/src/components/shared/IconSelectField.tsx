import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ChevronRightIcon } from "@/components/ui/Icon";
import { findOpenMoji } from "@/lib/openmoji";
import { colors, radii, spacing, typography } from "@/lib/theme";

interface IconSelectFieldProps {
  name: string;
  color: string;
  icon: string;
  iconUrl?: string;
  uploading: boolean;
  onPress: () => void;
}

// The form row for a record's icon: a preview of what is set now and what it
// is, tapping through to the picker panel (use-icon-picker).
export function IconSelectField({ name, color, icon, iconUrl, uploading, onPress }: IconSelectFieldProps) {
  const description = iconUrl
    ? "Ảnh đã tải lên"
    : icon
      ? findOpenMoji(icon)?.annotation ?? icon
      : "Chưa chọn — dùng biểu tượng mặc định";

  return (
    <Pressable style={styles.row} onPress={onPress} disabled={uploading} testID="field-icon-select">
      <View style={styles.preview}>
        {uploading ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : (
          <Avatar name={name || "?"} color={color} size={44} icon={icon} iconUrl={iconUrl} />
        )}
      </View>
      <View style={styles.textCol}>
        <Text style={styles.value} numberOfLines={1}>
          {uploading ? "Đang tải ảnh lên…" : description}
        </Text>
        <Text style={styles.hint}>Chạm để chọn emoji hoặc tải ảnh</Text>
      </View>
      <ChevronRightIcon size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  preview: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  textCol: { flex: 1, minWidth: 0, gap: 2 },
  value: { ...typography.body, color: colors.textPrimary },
  hint: { ...typography.tiny, color: colors.textMuted },
});
