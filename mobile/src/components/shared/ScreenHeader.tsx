import { ComponentType, ReactNode } from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";
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
 * A pushed screen's header, iOS large-title style: a slim bar with the round
 * back button (and an action on the right), then the title large and bold
 * on its own line, left-aligned with the content under it. Same spacing on
 * every screen, so moving between them the title never jumps.
 */
export function ScreenHeader({ title, subtitle, onBack, backTestID, trailing, style }: ScreenHeaderProps) {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const showBack = onBack !== false;
  const goBack = typeof onBack === "function" ? onBack : () => router.back();

  return (
    <View style={[styles.header, style]}>
      {showBack || trailing ? (
        <View style={styles.bar}>
          {showBack ? (
            <PressableScale
              onPress={goBack}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              testID={backTestID}
              style={styles.back}
            >
              <BackGlyph size={18} weight="bold" color={colors.textPrimary} />
            </PressableScale>
          ) : (
            <View />
          )}
          {trailing}
        </View>
      ) : null}
      <Text
        style={styles.title}
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
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: BUTTON_SIZE,
    marginBottom: spacing.sm,
  },
  back: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  title: { ...typography.hero, letterSpacing: -0.5, color: colors.textPrimary },
  subtitle: { ...typography.caption, fontWeight: "500", color: colors.textSecondary, marginTop: spacing.xs },
  action: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
  },
}));
