import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  return (
    <View style={styles.bar}>
      <Pressable
        testID="btn-chat-search-close"
        accessibilityRole="button"
        accessibilityLabel={t("chat.search.close.a11y")}
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
          placeholder={searchableCount > 0 ? t("chat.search.placeholder", { count: searchableCount }) : t("chat.search.placeholderEmpty")}
          autoFocus
          testID="input-chat-search"
        />
      </View>
    </View>
  );
}

const useStyles = createStyles(() => ({
  // ChatModeHeader's 56px bar, so the thread below does not move when the
  // search takes its place.
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 56,
    paddingLeft: spacing.md,
    paddingRight: spacing.xl,
  },
  back: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
  field: { flex: 1 },
}));
