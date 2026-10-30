import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { EmojiGlyph } from "@/components/ui/EmojiGlyph";
import { OpenMojiGrid } from "@/components/shared/OpenMojiGrid";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

interface EmojiPickerInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Replaces a free-text TextInput for the "icon" field on Category/Wallet/
// Budget forms — typing full text there was meaningless since only the
// first emoji-like grapheme is ever displayed (Avatar.tsx). Tapping the
// field opens an in-app grid of curated emojis instead of the OS keyboard,
// since neither iOS nor Android exposes an API to force the system keyboard
// into an emoji-only mode (the emoji keyboard is a user-side keyboard
// switch, not something an app can select programmatically).
//
// The grid is the full OpenMoji set, grouped (see OpenMojiGrid), in its
// fixed-height inline mode — this field lives inside lists that already
// scroll. Forms that own a Drawer use use-icon-picker's panel instead.
export function EmojiPickerInput({ value, onChange, placeholder }: EmojiPickerInputProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <View style={styles.row}>
        <Pressable style={[styles.input, styles.flex]} onPress={() => setOpen((o) => !o)}>
          {value ? <EmojiGlyph emoji={value} size={26} /> : <Text style={styles.placeholderText}>{placeholder ?? t("ui.emojiPicker.placeholder")}</Text>}
        </Pressable>
        {value ? (
          <Pressable onPress={() => onChange("")} hitSlop={8} style={styles.clearButton}>
            <Text style={styles.clearLabel}>{t("ui.emojiPicker.clear")}</Text>
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View style={styles.grid}>
          <OpenMojiGrid
            mode="inline"
            value={value}
            onSelect={(e) => {
              onChange(e);
              setOpen(false);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  input: {
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  placeholderText: { ...typography.body, color: colors.textMuted },
  clearButton: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  clearLabel: { ...typography.caption, color: colors.peach },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: withAlpha(colors.overlayBase, 0.04),
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
}));
