import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing, typography } from "@/lib/theme";

interface EmojiPickerInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Curated set covering the common wallet/category/budget icon use cases
// (shopping, food, transport, bills, entertainment, health, money, misc.) —
// not the device's full emoji table, since this field is meant to label a
// finance record, not support arbitrary emoji typing.
const EMOJI_OPTIONS = [
  "🛒", "🍔", "🍕", "☕", "🍺", "🍿", "🚗", "⛽", "🚌", "🚕",
  "✈️", "🏠", "💡", "🧾", "📱", "💊", "🏥", "🎓", "📚", "🎮",
  "🎬", "🎉", "⚽", "🛍️", "👕", "🎁", "🐶", "🧹", "🛠️", "☂️",
  "💰", "💵", "💳", "🏦", "📈", "💸", "🪙", "💼", "📦", "❓",
] as const;

// Replaces a free-text TextInput for the "icon" field on Category/Wallet/
// Budget forms — typing full text there was meaningless since only the
// first emoji-like grapheme is ever displayed (Avatar.tsx). Tapping the
// field opens an in-app grid of curated emojis instead of the OS keyboard,
// since neither iOS nor Android exposes an API to force the system keyboard
// into an emoji-only mode (the emoji keyboard is a user-side keyboard
// switch, not something an app can select programmatically).
export function EmojiPickerInput({ value, onChange, placeholder = "Chọn emoji" }: EmojiPickerInputProps) {
  const [open, setOpen] = useState(false);

  return (
    <View>
      <View style={styles.row}>
        <Pressable style={[styles.input, styles.flex]} onPress={() => setOpen((o) => !o)}>
          <Text style={value ? styles.valueText : styles.placeholderText}>{value || placeholder}</Text>
        </Pressable>
        {value ? (
          <Pressable onPress={() => onChange("")} hitSlop={8} style={styles.clearButton}>
            <Text style={styles.clearLabel}>Xóa</Text>
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View style={styles.grid}>
          {EMOJI_OPTIONS.map((e) => (
            <Pressable
              key={e}
              style={[styles.cell, value === e && styles.cellActive]}
              onPress={() => {
                onChange(e);
                setOpen(false);
              }}
            >
              <Text style={styles.emoji}>{e}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  input: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  valueText: { fontSize: 22 },
  placeholderText: { ...typography.body, color: colors.textMuted },
  clearButton: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  clearLabel: { ...typography.caption, color: colors.peach },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  cell: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.listCard,
  },
  cellActive: { backgroundColor: "rgba(255,255,255,0.12)" },
  emoji: { fontSize: 22 },
});
