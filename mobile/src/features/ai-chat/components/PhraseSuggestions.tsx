import { memo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { PinIcon } from "@/components/ui/Icon";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { usePhraseActions } from "@/features/ai-chat/hooks/use-phrase-actions";
import { PhraseSuggestion } from "@/features/ai-chat/hooks/use-phrase-suggestions";

// The pin is small; its touch target should not be.
const PIN_HIT_SLOP = 12;

interface PhraseSuggestionsProps {
  suggestions: PhraseSuggestion[];
  /** Never taller than this — a fifth of the conversation area (spec BR-05). */
  maxHeight: number;
  /** Replaces the whole input with the phrase. Never sends. */
  onSelect: (text: string) => void;
}

/**
 * Phrases the User can reuse, directly above the recording input while it is
 * focused: saved ones (pinned) first, then recently confirmed ones. Each row's
 * pin saves or un-saves that phrase.
 *
 * `keyboardShouldPersistTaps="always"`: a tap here must fill the input, not
 * blur it — blurring would hide this list before the tap landed.
 */
export function PhraseSuggestions({ suggestions, maxHeight, onSelect }: PhraseSuggestionsProps) {
  const styles = useStyles();
  if (suggestions.length === 0) return null;
  return (
    <ScrollView
      testID="list-phrase-suggestions"
      style={[styles.list, { maxHeight }]}
      keyboardShouldPersistTaps="always"
      nestedScrollEnabled
    >
      {suggestions.map((suggestion, index) => (
        <SuggestionRow
          key={suggestion.text}
          suggestion={suggestion}
          index={index}
          onSelect={onSelect}
        />
      ))}
    </ScrollView>
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
// The save toggle is a trailing pin button, not a hold menu: a menu is a
// Modal, opening it blurs the input, and a blurred input hides this whole
// list — the menu would vanish with it. A tap inside this list keeps focus.
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
        <Pressable
          testID={`btn-phrase-pin-${index}`}
          accessibilityRole="button"
          accessibilityLabel={phrase.saved ? "Bỏ lưu câu mẫu" : "Lưu câu mẫu"}
          accessibilityState={{ selected: phrase.saved }}
          onPress={phrase.toggle}
          hitSlop={PIN_HIT_SLOP}
        >
          <PinIcon size={16} color={phrase.saved ? colors.mustard : colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
});

const useStyles = createStyles((colors) => ({
  list: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  pressed: { backgroundColor: colors.surfaceRaised },
  label: { flex: 1, ...typography.body, color: colors.textPrimary },
}));
