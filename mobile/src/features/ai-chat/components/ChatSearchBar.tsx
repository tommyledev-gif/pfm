import { Pressable, View } from "react-native";

import { ChevronLeftIcon } from "@/components/ui/Icon";
import { SearchField } from "@/components/ui/SearchField";
import { spacing, createStyles, useColors } from "@/lib/theme";

interface ChatSearchBarProps {
  query: string;
  onChangeQuery: (query: string) => void;
  /** Messages there are to search in the pane on screen. */
  searchableCount: number;
  onClose: () => void;
}

/**
 * Stands in for ChatModeHeader while the thread is being searched: a way
 * back and the field, keyboard up at once. The results are ChatSearchResults,
 * over the thread below.
 */
export function ChatSearchBar({ query, onChangeQuery, searchableCount, onClose }: ChatSearchBarProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.bar}>
      <Pressable
        testID="btn-chat-search-close"
        accessibilityRole="button"
        accessibilityLabel="Đóng tìm kiếm"
        onPress={onClose}
        hitSlop={8}
        style={styles.back}
      >
        <ChevronLeftIcon size={20} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.field}>
        <SearchField
          value={query}
          onChangeText={onChangeQuery}
          placeholder={searchableCount > 0 ? `Tìm trong ${searchableCount} tin nhắn` : "Tìm tin nhắn"}
          autoFocus
          testID="input-chat-search"
        />
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // ChatModeHeader's strip, 2px less padding each way: its row is the 40px
  // logo tile, this one the 44px field, so the thread below does not move.
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.md - 2,
    paddingBottom: spacing.lg - 2,
    paddingLeft: spacing.md,
    paddingRight: spacing.xl,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  back: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
  field: { flex: 1 },
}));
