import { Pressable, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CloseIcon, SearchIcon } from "@/components/ui/Icon";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  testID?: string;
  /** Off for non-Vietnamese queries (OpenMoji's English names). */
  autoCorrect?: boolean;
  /** Takes the keyboard as soon as it mounts (a search opened on purpose). */
  autoFocus?: boolean;
}

const FIELD_HEIGHT = 44;

/**
 * The one search input of every picker — a tonal field, no border: it sits
 * on a sheet that is already a surface, and a ring around it was one more
 * outline in a stack of them. The clear button only exists while there is
 * something to clear.
 */
export function SearchField({ value, onChangeText, placeholder, testID, autoCorrect, autoFocus }: SearchFieldProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <SearchIcon size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        autoCorrect={autoCorrect}
        autoCapitalize={autoCorrect === false ? "none" : undefined}
        autoFocus={autoFocus}
        returnKeyType="search"
        testID={testID}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("common.action.clearSearch")}>
          <CloseIcon size={16} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    height: FIELD_HEIGHT,
    paddingHorizontal: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: colors.surfaceRaised,
  },
  input: { flex: 1, paddingVertical: 0, color: colors.textPrimary, ...typography.body },
}));
