import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { EmojiGlyph } from "@/components/ui/EmojiGlyph";
import { SearchField } from "@/components/ui/SearchField";
import {
  OPENMOJI_GROUPS,
  OPENMOJIS_BY_GROUP,
  OpenMoji,
  OpenMojiGroupKey,
  findOpenMoji,
  searchOpenMoji,
} from "@/lib/openmoji";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

const COLUMNS = 7;
const GLYPH_SIZE = 30;
// Inline mode (inside an already-scrolling list) gets a fixed-height box.
const INLINE_HEIGHT = 240;
const SELECTED_CELL_ALPHA = 0.18;

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
  const { t } = useTranslation();
  const styles = useStyles();
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
      <SearchField value={query} onChangeText={setQuery} placeholder={t("ui.openMoji.searchPlaceholder")} autoCorrect={false} />

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
              <Text style={[styles.groupLabel, group === g.key && styles.groupLabelActive]}>{t(g.labelKey)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {items.length === 0 ? (
        <Text style={styles.empty}>{t("ui.openMoji.empty")}</Text>
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

      <Text style={styles.credit}>{t("ui.openMoji.credit")}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  fill: { flex: 1 },
  groupScroll: { flexGrow: 0, marginTop: spacing.sm },
  groupRow: { gap: spacing.xs, paddingBottom: spacing.sm },
  // A tab row, not a set of buttons: only the current group gets a fill, in
  // the same tonal step as every other chip — a neon pill here outshouted the
  // one action on the sheet that actually needs the accent.
  groupChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radii.pill },
  groupChipActive: { backgroundColor: colors.surfaceRaised },
  groupLabel: { ...typography.caption, color: colors.textSecondary },
  groupLabelActive: { color: colors.textPrimary },
  // A fraction of the row rather than a fixed size, so seven always fit
  // whatever the panel's width.
  cell: {
    width: `${100 / COLUMNS}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.listCard - 4,
  },
  cellActive: { backgroundColor: withAlpha(colors.green, SELECTED_CELL_ALPHA) },
  inlineBox: { height: INLINE_HEIGHT, marginTop: spacing.xs },
  wrap: { flexDirection: "row", flexWrap: "wrap" },
  empty: { ...typography.caption, color: colors.textMuted, textAlign: "center", paddingVertical: spacing.xl },
  credit: { ...typography.tiny, color: colors.textMuted, textAlign: "center", marginTop: spacing.xs },
}));
