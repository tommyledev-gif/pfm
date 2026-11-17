import { memo, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { EdgeFade } from "@/components/ui/EdgeFade";
import { CloseIcon, PinIcon, SearchIcon } from "@/components/ui/Icon";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { useReportComposerFocus } from "@/features/ai-chat/components/KeyboardLiftView";
import { usePhraseActions } from "@/features/ai-chat/hooks/use-phrase-actions";
import { usePhraseSuggestions } from "@/features/ai-chat/hooks/use-phrase-suggestions";

// The pin and remove buttons are small; their touch targets should not be.
const ICON_HIT_SLOP = 12;
// The list shows at least 2 phrases and at most 5 at a time, however much room
// the pane has: a one-row list read as broken, a taller one covered the thread.
// Past 5, it scrolls.
const MIN_VISIBLE_ROWS = 2;
const MAX_VISIBLE_ROWS = 5;
// While a message is being typed, only its closest matches — a hint, not a list.
const AUTOCOMPLETE_LIMIT = MAX_VISIBLE_ROWS;
// A row's height until the first one has been laid out and reports its own.
const ROW_HEIGHT_ESTIMATE = 46;
const FADE_HEIGHT = 28;
// Below this much hidden content the list counts as fully shown.
const SCROLL_EPSILON = 2;

interface PhraseSuggestionsProps {
  /** The message being typed: its closest matches show while the search is empty. */
  input: string;
  userId: string | null;
  /**
   * How tall the list may be: a fifth of the conversation area (spec BR-05).
   * Counted in rows, kept between MIN_VISIBLE_ROWS and MAX_VISIBLE_ROWS.
   */
  maxHeight: number;
  /** Replaces the whole input with the phrase. Never sends. */
  onSelect: (text: string, fromSearch: boolean) => void;
  /** The search field's own focus, so the panel stays open while it has it. */
  onSearchFocusChange: (focused: boolean) => void;
  /** Room kept at the right of the search's line (the location tab sits there). */
  searchInsetRight?: number;
}

/**
 * Phrases the User can reuse, above the recording input while it is focused.
 * Not the whole list any more: a small search field ("Tìm trong 12 câu mẫu"),
 * which lists every phrase once it is tapped and narrows them as it is typed
 * into. While only the message is being typed, its few closest matches show.
 * Each row prioritizes (lists it first, keeps it) or removes its phrase.
 *
 * `keyboardShouldPersistTaps="always"`: a tap on a row must fill the input,
 * not blur it — blurring would hide this panel before the tap landed.
 */
export function PhraseSuggestions({
  input,
  userId,
  maxHeight,
  onSelect,
  onSearchFocusChange,
  searchInsetRight = 0,
}: PhraseSuggestionsProps) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const reportComposerFocus = useReportComposerFocus();
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  // Measured without state: only whether more is hidden below re-renders.
  const scrollMetrics = useRef({ box: 0, content: 0, y: 0 });
  const [moreBelow, setMoreBelow] = useState(false);
  const measureMoreBelow = (patch: Partial<typeof scrollMetrics.current>) => {
    const metrics = Object.assign(scrollMetrics.current, patch);
    setMoreBelow(metrics.content - metrics.box - metrics.y > SCROLL_EPSILON);
  };
  // One row's real height, from the first row: the list is sized in rows.
  const [rowHeight, setRowHeight] = useState(ROW_HEIGHT_ESTIMATE);
  const measureRow = useLatestCallback((height: number) =>
    setRowHeight((prev) => (Math.abs(prev - height) < 0.5 ? prev : height)),
  );
  const visibleRows = Math.min(MAX_VISIBLE_ROWS, Math.max(MIN_VISIBLE_ROWS, Math.floor(maxHeight / rowHeight)));

  // A focused field that unmounts sends no blur: let go of the lift ourselves.
  const searchFocusedRef = useRef(false);
  const releaseFocus = useLatestCallback(() => {
    if (!searchFocusedRef.current) return;
    reportComposerFocus(false);
    onSearchFocusChange(false);
  });
  useEffect(() => releaseFocus, [releaseFocus]);

  const searching = searchFocused || search.trim() !== "";
  const { suggestions, total } = usePhraseSuggestions(searching ? search : input, userId, {
    exclude: input,
    limit: searching ? undefined : AUTOCOMPLETE_LIMIT,
    listAllWhenEmpty: searching,
  });
  const select = useLatestCallback((text: string) => {
    onSelect(text, searching);
    setSearch("");
  });

  // Kept while its field has focus, even after the last phrase is removed.
  if (total === 0 && !searchFocused) return null;

  const handleSearchFocus = (focused: boolean) => {
    searchFocusedRef.current = focused;
    setSearchFocused(focused);
    // Part of the composer: the keyboard lift holds while this has focus too.
    reportComposerFocus(focused);
    onSearchFocusChange(focused);
  };

  return (
    <View style={styles.panel}>
      {suggestions.length > 0 ? (
        <View style={[styles.listBox, { maxHeight: visibleRows * rowHeight }]}>
          <ScrollView
            testID="list-phrase-suggestions"
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            // Android: the bar stays drawn, so a list taller than its box
            // reads as scrollable before it is touched.
            persistentScrollbar
            onLayout={(e) => measureMoreBelow({ box: e.nativeEvent.layout.height })}
            onContentSizeChange={(_w, h) => measureMoreBelow({ content: h })}
            onScroll={(e) => measureMoreBelow({ y: e.nativeEvent.contentOffset.y })}
            scrollEventThrottle={32}
          >
            {suggestions.map((suggestion, index) => (
              <SuggestionRow
                key={suggestion.text}
                text={suggestion.text}
                index={index}
                onSelect={select}
                onMeasure={index === 0 ? measureRow : undefined}
              />
            ))}
          </ScrollView>
          {moreBelow ? <EdgeFade edge="bottom" width={FADE_HEIGHT} color={colors.surface} /> : null}
        </View>
      ) : search.trim() ? (
        <Text style={styles.noMatch}>{t("chat.phrases.noMatch")}</Text>
      ) : null}

      <View style={{ paddingRight: searchInsetRight }}>
        <View style={styles.searchField}>
          <SearchIcon size={14} color={colors.textMuted} />
          <TextInput
            testID="input-phrase-search"
            value={search}
            onChangeText={setSearch}
            onFocus={() => handleSearchFocus(true)}
            onBlur={() => handleSearchFocus(false)}
            placeholder={t("chat.phrases.search.placeholder", { count: total })}
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={ICON_HIT_SLOP} accessibilityRole="button" accessibilityLabel={t("common.action.clearSearch")}>
              <CloseIcon size={14} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

interface SuggestionRowProps {
  text: string;
  index: number;
  onSelect: (text: string) => void;
  /** Only the first row reports its height: they are all the same. */
  onMeasure?: (height: number) => void;
}

// Memoised: the list re-renders as the input changes, but a row only changes
// when its own phrase or priority state does.
//
// Prioritize and remove are trailing buttons, not a hold menu: a menu is a
// Modal, opening it blurs the input, and a blurred input hides this whole
// panel — the menu would vanish with it. A tap inside this list keeps focus.
const SuggestionRow = memo(function SuggestionRow({ text, index, onSelect, onMeasure }: SuggestionRowProps) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const phrase = usePhraseActions(text);

  return (
    <Pressable
      testID={`row-phrase-suggestion-${index}`}
      accessibilityRole="button"
      onPress={() => onSelect(text)}
      onLayout={onMeasure ? (e) => onMeasure(e.nativeEvent.layout.height) : undefined}
      style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}
    >
      <Text style={styles.label} numberOfLines={1}>
        {text}
      </Text>
      {phrase.available ? (
        <>
          <Pressable
            testID={`btn-phrase-pin-${index}`}
            accessibilityRole="button"
            accessibilityLabel={phrase.saved ? t("chat.phrases.unprioritize") : t("chat.phrases.prioritize")}
            accessibilityState={{ selected: phrase.saved }}
            onPress={phrase.toggle}
            hitSlop={ICON_HIT_SLOP}
          >
            <PinIcon size={16} color={phrase.saved ? colors.mustard : colors.textMuted} />
          </Pressable>
          <Pressable
            testID={`btn-phrase-remove-${index}`}
            accessibilityRole="button"
            accessibilityLabel={t("chat.phrases.delete")}
            onPress={phrase.remove}
            hitSlop={ICON_HIT_SLOP}
          >
            <CloseIcon size={16} color={colors.textMuted} />
          </Pressable>
        </>
      ) : null}
    </Pressable>
  );
});

const useStyles = createStyles((colors) => ({
  panel: { marginHorizontal: spacing.xl, marginBottom: spacing.sm, gap: spacing.xs },
  listBox: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  pressed: { backgroundColor: colors.surfaceRaised },
  label: { flex: 1, ...typography.body, color: colors.textPrimary },
  noMatch: { ...typography.caption, color: colors.textMuted, paddingHorizontal: spacing.sm },
  // Small on purpose: a way into the phrases, not a second message box.
  searchField: {
    alignSelf: "flex-start",
    minWidth: "55%",
    maxWidth: "100%",
    height: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  searchInput: { flex: 1, paddingVertical: 0, color: colors.textPrimary, ...typography.caption },
}));
