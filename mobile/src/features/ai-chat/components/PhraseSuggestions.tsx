import { memo, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { EdgeFade } from "@/components/ui/EdgeFade";
import { CloseIcon, PinIcon, SearchIcon } from "@/components/ui/Icon";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { useReportComposerFocus } from "@/features/ai-chat/components/KeyboardLiftView";
import { usePhraseActions } from "@/features/ai-chat/hooks/use-phrase-actions";
import { PhraseSuggestion, usePhraseSuggestions } from "@/features/ai-chat/hooks/use-phrase-suggestions";

// The pin and remove buttons are small; their touch targets should not be.
const ICON_HIT_SLOP = 12;
// While a message is being typed, only its closest matches — a hint, not a list.
const AUTOCOMPLETE_LIMIT = 3;
const FADE_HEIGHT = 28;
// Below this much hidden content the list counts as fully shown.
const SCROLL_EPSILON = 2;

interface PhraseSuggestionsProps {
  /** The message being typed: its closest matches show while the search is empty. */
  input: string;
  userId: string | null;
  /** The list is never taller than this — a fifth of the conversation area (spec BR-05). */
  maxHeight: number;
  /** Replaces the whole input with the phrase. Never sends. */
  onSelect: (text: string, fromSearch: boolean) => void;
  /** The search field's own focus, so the panel stays open while it has it. */
  onSearchFocusChange: (focused: boolean) => void;
}

/**
 * Phrases the User can reuse, above the recording input while it is focused.
 * Not the whole list any more: a small search field ("Tìm trong 12 câu mẫu"),
 * which lists every phrase once it is tapped and narrows them as it is typed
 * into. While only the message is being typed, its few closest matches show.
 * Each row pins (saves) or removes its phrase.
 *
 * `keyboardShouldPersistTaps="always"`: a tap on a row must fill the input,
 * not blur it — blurring would hide this panel before the tap landed.
 */
export function PhraseSuggestions({ input, userId, maxHeight, onSelect, onSearchFocusChange }: PhraseSuggestionsProps) {
  const colors = useColors();
  const styles = useStyles();
  const reportComposerFocus = useReportComposerFocus();
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [boxHeight, setBoxHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);

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
  // Kept while its field has focus, even after the last phrase is removed.
  if (total === 0 && !searchFocused) return null;

  const moreBelow = contentHeight - boxHeight - scrollY > SCROLL_EPSILON;
  const handleSearchFocus = (focused: boolean) => {
    searchFocusedRef.current = focused;
    setSearchFocused(focused);
    // Part of the composer: the keyboard lift holds while this has focus too.
    reportComposerFocus(focused);
    onSearchFocusChange(focused);
  };
  const select = (text: string) => {
    onSelect(text, searching);
    setSearch("");
  };

  return (
    <View style={styles.panel}>
      {suggestions.length > 0 ? (
        <View style={[styles.listBox, { maxHeight }]}>
          <ScrollView
            testID="list-phrase-suggestions"
            keyboardShouldPersistTaps="always"
            nestedScrollEnabled
            // Android: the bar stays drawn, so a list taller than its box
            // reads as scrollable before it is touched.
            persistentScrollbar
            onLayout={(e) => setBoxHeight(e.nativeEvent.layout.height)}
            onContentSizeChange={(_w, h) => setContentHeight(h)}
            onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={32}
          >
            {suggestions.map((suggestion, index) => (
              <SuggestionRow key={suggestion.text} suggestion={suggestion} index={index} onSelect={select} />
            ))}
          </ScrollView>
          {moreBelow ? <EdgeFade edge="bottom" width={FADE_HEIGHT} color={colors.surface} /> : null}
        </View>
      ) : search.trim() ? (
        <Text style={styles.noMatch}>Không tìm thấy câu mẫu</Text>
      ) : null}

      <View style={styles.searchField}>
        <SearchIcon size={14} color={colors.textMuted} />
        <TextInput
          testID="input-phrase-search"
          value={search}
          onChangeText={setSearch}
          onFocus={() => handleSearchFocus(true)}
          onBlur={() => handleSearchFocus(false)}
          placeholder={`Tìm trong ${total} câu mẫu`}
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} hitSlop={ICON_HIT_SLOP} accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm">
            <CloseIcon size={14} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface SuggestionRowProps {
  suggestion: PhraseSuggestion;
  index: number;
  onSelect: (text: string) => void;
}

// Memoised: the list re-renders as the input changes, but a row only changes
// when its own phrase or saved state does.
//
// Pin and remove are trailing buttons, not a hold menu: a menu is a Modal,
// opening it blurs the input, and a blurred input hides this whole panel —
// the menu would vanish with it. A tap inside this list keeps focus.
const SuggestionRow = memo(function SuggestionRow({ suggestion, index, onSelect }: SuggestionRowProps) {
  const colors = useColors();
  const styles = useStyles();
  const phrase = usePhraseActions(suggestion.text);

  return (
    <Pressable
      testID={`row-phrase-suggestion-${index}`}
      accessibilityRole="button"
      onPress={() => onSelect(suggestion.text)}
      style={({ pressed }) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}
    >
      <Text style={styles.label} numberOfLines={1}>
        {suggestion.text}
      </Text>
      {phrase.available ? (
        <>
          <Pressable
            testID={`btn-phrase-pin-${index}`}
            accessibilityRole="button"
            accessibilityLabel={phrase.saved ? "Bỏ lưu câu mẫu" : "Lưu câu mẫu"}
            accessibilityState={{ selected: phrase.saved }}
            onPress={phrase.toggle}
            hitSlop={ICON_HIT_SLOP}
          >
            <PinIcon size={16} color={phrase.saved ? colors.mustard : colors.textMuted} />
          </Pressable>
          <Pressable
            testID={`btn-phrase-remove-${index}`}
            accessibilityRole="button"
            accessibilityLabel="Xóa câu mẫu"
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
