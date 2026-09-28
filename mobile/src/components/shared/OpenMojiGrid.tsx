import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { EmojiGlyph } from "@/components/ui/EmojiGlyph";
import { SearchIcon } from "@/components/ui/Icon";
import {
  OPENMOJI_GROUPS,
  OPENMOJIS_BY_GROUP,
  OpenMoji,
  OpenMojiGroupKey,
  findOpenMoji,
  searchOpenMoji,
} from "@/lib/openmoji";
import { colors, radii, spacing, typography } from "@/lib/theme";

const COLUMNS = 7;
const GLYPH_SIZE = 30;
// Inline mode (inside an already-scrolling list) gets a fixed-height box.
const INLINE_HEIGHT = 240;

interface OpenMojiGridProps {
  value: string;
  onSelect: (emoji: string) => void;
  /**
   * "fill" takes the parent's full height with a virtualized grid — for a
   * Drawer child panel. "inline" is a fixed-height, non-virtualized box, for
   * hosts that already sit inside a list (a FlatList inside another list's
   * ScrollView is exactly what VirtualizedList warns against).
   */
  mode?: "fill" | "inline";
}

/**
 * The OpenMoji picker body: a chip row of OpenMoji's own groups, an
 * English-annotation search (the only names OpenMoji publishes), and the grid.
 * Opens on the group of the current value, so editing an icon starts where it
 * already lives.
 */
export function OpenMojiGrid({ value, onSelect, mode = "fill" }: OpenMojiGridProps) {
  const initialGroup = findOpenMoji(value)?.group ?? OPENMOJI_GROUPS[0].key;
  const [group, setGroup] = useState<OpenMojiGroupKey>(initialGroup);
  const [query, setQuery] = useState("");

  const items = useMemo(
    () => (query.trim() ? searchOpenMoji(query) : OPENMOJIS_BY_GROUP[group] ?? []),
    [group, query],
  );
  const selected = findOpenMoji(value)?.emoji;

  const renderCell = (item: OpenMoji) => (
    <Pressable
      key={item.hexcode}
      style={[styles.cell, selected === item.emoji && styles.cellActive]}
      onPress={() => onSelect(item.emoji)}
      accessibilityLabel={item.annotation}
    >
      <EmojiGlyph emoji={item.emoji} size={GLYPH_SIZE} />
    </Pressable>
  );

  return (
    <View style={mode === "fill" ? styles.fill : undefined}>
      <View style={styles.searchRow}>
        <SearchIcon size={16} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm bằng tiếng Anh, vd: coffee"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      {!query.trim() ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupRow}
          style={styles.groupScroll}
          keyboardShouldPersistTaps="handled"
        >
          {OPENMOJI_GROUPS.map((g) => (
            <Pressable
              key={g.key}
              onPress={() => setGroup(g.key)}
              style={[styles.groupChip, group === g.key && styles.groupChipActive]}
            >
              <Text style={[styles.groupLabel, group === g.key && styles.groupLabelActive]}>{g.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {items.length === 0 ? (
        <Text style={styles.empty}>Không tìm thấy biểu tượng nào.</Text>
      ) : mode === "fill" ? (
        <FlatList
          // Remounted per group/search so the grid starts from the top.
          key={query.trim() ? `q-${query}` : group}
          data={items}
          keyExtractor={(item) => item.hexcode}
          numColumns={COLUMNS}
          renderItem={({ item }) => renderCell(item)}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={COLUMNS * 8}
          style={styles.fill}
        />
      ) : (
        <ScrollView style={styles.inlineBox} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <View style={styles.wrap}>{items.map(renderCell)}</View>
        </ScrollView>
      )}

      <Text style={styles.credit}>Biểu tượng: OpenMoji (CC BY-SA 4.0)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: colors.textPrimary, ...typography.body },
  groupScroll: { flexGrow: 0, marginTop: spacing.sm },
  groupRow: { gap: spacing.xs, paddingBottom: spacing.sm },
  groupChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  groupChipActive: { backgroundColor: colors.green, borderColor: colors.green },
  groupLabel: { ...typography.caption, color: colors.textSecondary },
  groupLabelActive: { color: colors.onGreen },
  // A fraction of the row rather than a fixed size, so seven always fit
  // whatever the panel's width.
  cell: {
    width: `${100 / COLUMNS}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.listCard - 4,
  },
  cellActive: { backgroundColor: "rgba(133,255,51,0.18)" },
  inlineBox: { height: INLINE_HEIGHT, marginTop: spacing.xs },
  wrap: { flexDirection: "row", flexWrap: "wrap" },
  empty: { ...typography.caption, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.xl },
  credit: { ...typography.tiny, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
});
