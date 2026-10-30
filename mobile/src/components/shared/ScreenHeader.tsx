import { ComponentType, ReactNode } from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { PressableScale } from "@/components/motion/PressableScale";
import { BackGlyph, PlusGlyph } from "@/components/ui/grouped-list/list-icons";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";

const BUTTON_SIZE = 36;
// A long title ("Cài đặt người dùng") shrinks this far before it is cut.
const TITLE_MIN_SCALE = 0.75;

interface ScreenHeaderProps {
  title: string;
  /** One line under the title, when the title alone does not say enough. */
  subtitle?: string;
  /** Back button. Defaults to router.back(); false hides it (a tab's root). */
  onBack?: (() => void) | false;
  backTestID?: string;
  /** Right end of the top bar: usually a ScreenHeaderAction. */
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * A screen's header. A pushed screen's title sits on the back button's own
 * row, a gap after it, with an action at the far end (2026-10-24 — the title
 * used to drop to a line of its own under the button, a whole row spent on
 * one control). A tab's root, with no back button, keeps the large title on
 * its own. Same spacing on every screen, so moving between them the title
 * never jumps.
 */
export function ScreenHeader({ title, subtitle, onBack, backTestID, trailing, style }: ScreenHeaderProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const showBack = onBack !== false;
  const goBack = typeof onBack === "function" ? onBack : () => router.back();

  const titleBlock = (
    <View style={styles.titleBlock}>
      <Text
        style={showBack ? styles.titleInline : styles.title}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={TITLE_MIN_SCALE}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );

  return (
    <View style={[styles.header, style]}>
      <View style={styles.bar}>
        {showBack ? (
          <PressableScale
            onPress={goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t("common.action.back")}
            testID={backTestID}
            style={styles.back}
          >
            <BackGlyph size={18} weight="bold" color={colors.textPrimary} />
          </PressableScale>
        ) : null}
        {titleBlock}
        {trailing}
      </View>
    </View>
  );
}

interface ScreenHeaderActionProps {
  onPress: () => void;
  /** What the tap does: "Tạo danh mục", "Mời thành viên". */
  accessibilityLabel: string;
  icon?: ComponentType<{ size?: number; color?: string; weight?: "regular" | "bold" | "fill" }>;
  testID?: string;
}

/** The round green button at the top right (the screen's "add" action). */
export function ScreenHeaderAction({ onPress, accessibilityLabel, icon: Icon = PlusGlyph, testID }: ScreenHeaderActionProps) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <PressableScale
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={styles.action}
    >
      <Icon size={18} weight="bold" color={colors.onGreen} />
    </PressableScale>
  );
}

const useStyles = createStyles((colors) => ({
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.lg },
  bar: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: BUTTON_SIZE },
  titleBlock: { flex: 1, minWidth: 0 },
  back: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  title: { ...typography.hero, letterSpacing: -0.5, color: colors.textPrimary },
  // Beside the back button: a step down from the large title, so the row
  // stays one button tall.
  titleInline: { ...typography.hero, fontSize: 24, letterSpacing: -0.3, color: colors.textPrimary },
  subtitle: { ...typography.caption, fontWeight: "500", color: colors.textSecondary, marginTop: 2 },
  action: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
  },
}));
