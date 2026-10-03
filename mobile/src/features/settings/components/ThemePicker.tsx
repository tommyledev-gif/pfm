import { Pressable, Text, View } from "react-native";

import { CheckIcon } from "@/components/ui/Icon";
import { createStyles, radii, spacing, typography, useThemeName } from "@/lib/theme";
import { THEME_NAMES, THEMES, ThemeName } from "@/theme/palettes";
import { useSwitchTheme } from "@/theme/use-switch-theme";

const SWATCH_HEIGHT = 64;

// Settings → Giao diện. One tile per entry in THEMES, each a miniature of
// that theme painted in its OWN palette (ground, a card, the primary) — not
// the active one — so every option previews what it switches to. Tiles wrap,
// so adding a palette needs nothing here.
export function ThemePicker() {
  const styles = useStyles();
  const active = useThemeName();
  const switchTheme = useSwitchTheme();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Giao diện</Text>
      <View style={styles.options}>
        {THEME_NAMES.map((name) => (
          <ThemeOption
            key={name}
            name={name}
            selected={name === active}
            onPress={() => switchTheme(name)}
          />
        ))}
      </View>
    </View>
  );
}

function ThemeOption({ name, selected, onPress }: { name: ThemeName; selected: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { label, palette } = THEMES[name];

  return (
    <Pressable
      style={styles.option}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Giao diện ${label}`}
      testID={`btn-theme-${name}`}
    >
      <View style={[styles.swatch, { backgroundColor: palette.bgApp, borderColor: selected ? palette.green : palette.surfaceBorder }, selected && styles.swatchSelected]}>
        <View style={[styles.swatchCard, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}>
          <View style={[styles.swatchLine, { backgroundColor: palette.textPrimary }]} />
          <View style={[styles.swatchLineShort, { backgroundColor: palette.textMuted }]} />
        </View>
        <View style={[styles.swatchDot, { backgroundColor: palette.green }]}>
          {selected ? <CheckIcon size={12} color={palette.onGreen} strokeWidth={3} /> : null}
        </View>
      </View>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
  },
  title: { ...typography.body, color: colors.textPrimary },
  options: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  option: { flexGrow: 1, flexBasis: "40%", gap: spacing.sm, alignItems: "center" },
  swatch: {
    alignSelf: "stretch",
    height: SWATCH_HEIGHT,
    borderRadius: radii.listCard,
    borderWidth: 1,
    padding: spacing.sm,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  swatchSelected: { borderWidth: 2 },
  swatchCard: { flex: 1, gap: 4, padding: spacing.sm, borderRadius: 8, borderWidth: 1 },
  swatchLine: { height: 4, width: "70%", borderRadius: 2 },
  swatchLineShort: { height: 4, width: "40%", borderRadius: 2 },
  swatchDot: { width: 20, height: 20, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  label: { ...typography.label, color: colors.textSecondary },
  labelSelected: { color: colors.textPrimary },
}));
