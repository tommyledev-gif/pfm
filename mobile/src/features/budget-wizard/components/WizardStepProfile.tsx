import { Pressable, ScrollView, Text, View } from "react-native";

import { CheckIcon } from "@/components/ui/Icon";
import { EmojiGlyph } from "@/components/ui/EmojiGlyph";
import { PRESET_OPTIONS, PresetKey } from "@/features/budget-wizard/types";
import { withAlpha } from "@/lib/color";
import { colors, radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface WizardStepProfileProps {
  selected: PresetKey | null;
  onSelect: (key: PresetKey) => void;
}

// One tint per option while the user is still deciding — six identical grey
// rows give the eye nothing to tell them apart by. The tint is resting state
// only: the SELECTED row is always the primary green, because "this is the one
// I picked" is a single meaning and should have a single color everywhere in
// the app, not a different one per option.
// Getters, not values: read at render time so they follow a theme switch
// (see src/theme/active-palette.ts).
const PRESET_TINT: Record<PresetKey, string> = {
  get rented_eating_out() { return colors.periwinkle; },
  get with_family() { return colors.mint; },
  get couple_no_kids() { return colors.peach; },
  get own_family() { return colors.lavender; },
  get student() { return colors.mustard; },
  get retired() { return colors.mint; },
};

const ICON_TILE_SIZE = 44;
// Drawn through EmojiGlyph, the OpenMoji artwork every category icon uses
// (Avatar → EmojiGlyph), not as a raw emoji in a Text — the device's emoji
// font made these six look like they belonged to a different app than the
// category icons on the very next screen. Same ~0.6 of the tile as Avatar.
const ICON_GLYPH_SIZE = 26;
// A comfortable row, not a grid cell: the icon, a title and a line of
// description need vertical room, and six full-width rows are easier to
// compare than a 2×3 grid where the eye has to travel in two directions.
// Trimmed from 84 when the list went from four options to six — at the old
// height the last row sat under the footer on a short phone.
const ROW_MIN_HEIGHT = 72;

/**
 * Screen 2 — one question.
 *
 * v1 asked the user to set a spending level for each of up to 20 categories:
 * as many as 120 decisions, every one of which presumes they already know
 * their own spending. The people who install a budgeting app are precisely the
 * ones who do not, so those answers were guesses being treated as data.
 *
 * This asks about living situation instead — something the user knows for
 * certain, answers in one tap, and which correlates well enough with spending
 * shape to be a defensible starting point. The honest trade is stated plainly
 * on the next screen: it is an estimate, and it will be corrected.
 *
 * Each row carries a description of what the option implies for the budget.
 * Without it the user is matching themselves to a label; with it they are
 * choosing a shape, which is the actual decision being asked of them.
 *
 * The rows are centred in whatever height is left over rather than pinned
 * under the question: on a tall phone a top-aligned list of six left a block
 * of dead space above the footer and made the screen look unfinished.
 *
 * The ambient glow behind this step is drawn by BudgetWizardModal, not here —
 * see the note there.
 */
export function WizardStepProfile({ selected, onSelect }: WizardStepProfileProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text style={styles.title}>Bạn đang sống kiểu nào?</Text>
          <Text style={styles.subtitle}>Ngân sách khởi điểm dựa trên câu trả lời này.</Text>
        </View>

        {PRESET_OPTIONS.map((opt) => {
          const active = opt.key === selected;
          // Resting tint for the icon tile; the selected state is the app's
          // primary green, the same as every other "chosen" affordance.
          const tint = active ? colors.green : PRESET_TINT[opt.key];

          return (
            <Pressable
              key={opt.key}
              testID={`btn-wizard-preset-${opt.key}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => onSelect(opt.key)}
              style={[styles.row, active && { borderColor: tint, backgroundColor: `${tint}14` }]}
            >
              <View
                style={[
                  styles.iconTile,
                  { borderColor: `${tint}40` },
                  active && { backgroundColor: `${tint}26`, borderColor: `${tint}80` },
                ]}
              >
                <EmojiGlyph emoji={opt.icon} size={ICON_GLYPH_SIZE} />
              </View>

              <View style={styles.copy}>
                <Text style={[styles.label, active && { color: tint }]} numberOfLines={1}>
                  {opt.label}
                </Text>
                <Text style={styles.description} numberOfLines={2}>
                  {opt.description}
                </Text>
              </View>

              {/* A filled round check rather than a bare tick: at a glance it
                  reads as "this one", where a floating ✓ read as a decoration
                  on the row it happened to sit in. */}
              <View style={[styles.check, active ? { backgroundColor: tint, borderColor: tint } : null]}>
                {active ? <CheckIcon size={13} color={colors.onGreen} /> : null}
              </View>
            </Pressable>
          );
        })}

        {/* The free-text entry point ("kể tôi nghe cách bạn tiêu tiền") belongs
            to Phase 4 and is NOT rendered here, disabled or otherwise. A
            visible control that does nothing costs more trust than an absent
            one — the user cannot tell a deliberate gap from a broken button. */}
      </ScrollView>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  root: { flex: 1 },
  // flexGrow + centre, not a plain top-aligned stack: when the six rows are
  // shorter than the viewport they sit in the middle of it, and when they are
  // taller flexGrow does nothing and the list simply scrolls.
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  head: { gap: spacing.xs, marginBottom: spacing.sm },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  row: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  iconTile: {
    width: ICON_TILE_SIZE,
    height: ICON_TILE_SIZE,
    borderRadius: radii.listCard,
    borderWidth: 1,
    backgroundColor: withAlpha(colors.overlayBase, 0.04),
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  label: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
  description: { ...typography.tiny, color: colors.textSecondary, lineHeight: 15 },
  check: {
    width: 22,
    height: 22,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
  },
}));
