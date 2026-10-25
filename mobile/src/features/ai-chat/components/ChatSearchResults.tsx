import { memo } from "react";
import { FlatList, ListRenderItemInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PILL_HEIGHT } from "@/components/shared/bottom-nav-styles";
import { ChatSearchHit } from "@/features/ai-chat/chat-search";
import { messageCreatedAt } from "@/features/ai-chat/components/ChatMessageRow";
import { dayLabelVi, formatTime } from "@/lib/format-date";
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

// "Bạn · Hôm nay 14:05": who said it and when.
function hitMeta(hit: ChatSearchHit): string {
  const who = hit.message.role === "user" ? "Bạn" : "Trợ lý";
  const at = messageCreatedAt(hit.message.id);
  if (at === undefined) return who;
  const iso = new Date(at).toISOString();
  return `${who} · ${dayLabelVi(iso)} ${formatTime(iso)}`;
}

/**
 * The matches for the header's search, newest first, over the thread: who
 * and when, then the words around the match with the match in the pane's
 * colour. A tap goes to the message in the thread (useMessageJump).
 */
export function ChatSearchResults({ hits, tint, onSelect }: ChatSearchResultsProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const select = useLatestCallback(onSelect);
  // Clear of the keyboard while it is up, of the nav once it is down.
  const bottom = Math.max(keyboardHeight, insets.bottom + PILL_HEIGHT) + spacing.lg;

  if (hits.length === 0) {
    return (
      <View style={[styles.overlay, styles.empty]} testID="chat-search-empty">
        <Text style={styles.emptyTitle}>Không tìm thấy tin nhắn</Text>
        <Text style={styles.emptyHint}>Thử từ khóa khác.</Text>
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
      ListHeaderComponent={<Text style={styles.count}>{hits.length} tin nhắn</Text>}
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
