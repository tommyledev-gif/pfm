import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { DrawerChild } from "@/components/shared/Drawer";
import { OpenMojiGrid } from "@/components/shared/OpenMojiGrid";
import { UploadIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface UseIconPickerOptions {
  icon: string;
  onPickEmoji: (emoji: string) => void;
  /** Starts the device photo picker + upload. */
  onUpload: () => void;
}

/**
 * One icon choice for a Category/Wallet form, replacing the old pair of
 * controls (a "Tải ảnh lên" link and a separate emoji field). Hand `child` to
 * the form's Drawer and render an IconSelectField that calls `open`.
 *
 * The panel defaults to OpenMoji, grouped the way OpenMoji groups them, with
 * "Tải ảnh từ thiết bị" above the grid for anyone who wants their own image.
 * Picking closes the panel straight away — a single choice needs no confirm.
 */
export function useIconPicker({ icon, onPickEmoji, onUpload }: UseIconPickerOptions) {
  const colors = useColors();
  const styles = useStyles();
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);

  const child: DrawerChild = {
    visible,
    onClose: close,
    title: "Chọn biểu tượng",
    children: (
      <View style={styles.body}>
        <Pressable
          style={styles.uploadRow}
          onPress={() => {
            // Closed first: the system photo picker covers the app, and coming
            // back to a still-open panel over the form was one step too many.
            close();
            onUpload();
          }}
          testID="btn-icon-picker-upload"
        >
          <UploadIcon size={18} color={colors.green} />
          <Text style={styles.uploadLabel}>Tải ảnh từ thiết bị</Text>
        </Pressable>
        <OpenMojiGrid
          value={icon}
          onSelect={(emoji) => {
            onPickEmoji(emoji);
            close();
          }}
        />
      </View>
    ),
  };

  return { child, open };
}

const useStyles = createStyles((colors) => ({
  body: { flex: 1, gap: spacing.md },
  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: withAlpha(colors.green, 0.45),
    backgroundColor: withAlpha(colors.green, 0.06),
  },
  uploadLabel: { ...typography.body, color: colors.green },
}));
