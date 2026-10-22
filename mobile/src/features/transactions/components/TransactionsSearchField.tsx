import { memo, useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { SearchIcon } from "@/components/ui/Icon";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

const SEARCH_DEBOUNCE_MS = 400;

interface TransactionsSearchFieldProps {
  /** Seeds the field when it mounts; re-key it to seed again. */
  initialText: string;
  /** The trimmed text, once typing pauses. */
  onSearch: (text: string) => void;
}

/**
 * The Transactions search box. Owns what is being typed, so a keystroke
 * re-renders this field and nothing else; the list only hears the debounced
 * result.
 */
export const TransactionsSearchField = memo(function TransactionsSearchField({
  initialText,
  onSearch,
}: TransactionsSearchFieldProps) {
  const colors = useColors();
  const styles = useStyles();
  const [text, setText] = useState(initialText);
  // The seeded text is already applied by whoever seeded it.
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current) return;
    const handle = setTimeout(() => onSearch(text.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [text, onSearch]);

  const change = (next: string) => {
    typed.current = true;
    setText(next);
  };

  return (
    <View style={styles.searchRow}>
      <SearchIcon size={16} color={colors.textSecondary} />
      <TextInput
        value={text}
        onChangeText={change}
        placeholder="Tìm theo ghi chú..."
        placeholderTextColor={colors.textMuted}
        style={styles.searchInput}
      />
      {text ? (
        <Pressable onPress={() => change("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm">
          <Text style={styles.clearSearch}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, padding: 0 },
  clearSearch: { ...typography.body, color: colors.textSecondary },
}));
