import { memo } from "react";
import { FlatList, ListRenderItemInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { PILL_HEIGHT } from "@/components/shared/bottom-nav-styles";
import { ChatSearchHit } from "@/features/ai-chat/chat-search";
import { messageCreatedAt } from "@/features/ai-chat/components/ChatMessageRow";
import { dayLabel, formatTime } from "@/lib/format-date";
import { i18n } from "@/lib/i18n";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { spacing, typography, createStyles } from "@/lib/theme";

interface ChatSearchResultsProps {
  hits: ChatSearchHit[];
  /** The pane's colour, for the matched words. */
  tint: string;
  onSelect: (messageId: string) => void;
}

const hitKey = (hit: ChatSearchHit) => hit.message.id;

// "Bạn · Hôm nay 14:05": who said it and when. Called during render of a
// row that uses useTranslation().
function hitMeta(hit: ChatSearchHit): string {
  const who = i18n.t(hit.message.role === "user" ? "chat.search.who.user" : "chat.search.who.assistant");
  const at = messageCreatedAt(hit.message.id);
  if (at === undefined) return who;
  const iso = new Date(at).toISOString();
  return i18n.t("chat.search.hitMeta", { who, day: dayLabel(iso), time: formatTime(iso) });
}

/**
 * The matches for the header's search, newest first, over the thread: who
 * and when, then the words around the match with the match in the pane's
 * colour. A tap goes to the message in the thread (useMessageJump).
 */
export function ChatSearchResults({ hits, tint, onSelect }: ChatSearchResultsProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const select = useLatestCallback(onSelect);
  // Clear of the keyboard while it is up, of the nav once it is down.
  const bottom = Math.max(keyboardHeight, insets.bottom + PILL_HEIGHT) + spacing.lg;

  if (hits.length === 0) {
    return (
      <View style={[styles.overlay, styles.empty]} testID="chat-search-empty">
        <Text style={styles.emptyTitle}>{t("chat.search.empty.title")}</Text>
        <Text style={styles.emptyHint}>{t("common.empty.tryAnotherKeyword")}</Text>
      </View>
    );
  }

  const renderItem = ({ item }: ListRenderItemInfo<ChatSearchHit>) => (
    <HitRow hit={item} tint={tint} onSelect={select} />
  );

  return (
    <FlatList
      style={styles.overlay}
      data={hits}
      keyExtractor={hitKey}
      renderItem={renderItem}
      // The keyboard stays up between results; a tap still lands.
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<Text style={styles.count}>{t("chat.search.resultCount", { count: hits.length })}</Text>}
      ItemSeparatorComponent={Separator}
      contentContainerStyle={{ paddingBottom: bottom }}
      testID="chat-search-results"
    />
  );
}

const HitRow = memo(function HitRow({
  hit,
  tint,
  onSelect,
}: {
  hit: ChatSearchHit;
  tint: string;
  onSelect: (messageId: string) => void;
}) {
  const styles = useStyles();
  // hitMeta reads the language; this re-renders the memoized row on a switch.
  useTranslation();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(hit.message.id)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      testID={`chat-search-hit-${hit.message.id}`}
    >
      <Text style={styles.meta}>{hitMeta(hit)}</Text>
      <Text style={styles.snippet} numberOfLines={2}>
        {hit.before}
        <Text style={[styles.match, { color: tint }]}>{hit.match}</Text>
        {hit.after}
      </Text>
    </Pressable>
  );
});

function Separator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

const useStyles = createStyles((colors) => ({
  // Opaque, so the thread under it does not show through the results.
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bgApp },
  count: { ...typography.tiny, color: colors.textMuted, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  row: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: 2 },
  rowPressed: { backgroundColor: colors.surfaceRaised },
  meta: { ...typography.tiny, color: colors.textSecondary },
  snippet: { ...typography.body, color: colors.textPrimary },
  match: { fontWeight: "700" },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.surfaceBorder, marginHorizontal: spacing.xl },
  empty: { alignItems: "center", paddingTop: spacing.xxl, gap: spacing.xs },
  emptyTitle: { ...typography.body, fontWeight: "600", color: colors.textPrimary },
  emptyHint: { ...typography.caption, color: colors.textSecondary },
}));
