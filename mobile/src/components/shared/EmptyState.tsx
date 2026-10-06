import { ReactNode } from "react";
import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";

import { PillButton } from "@/components/ui/PillButton";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles } from "@/lib/theme";

export interface EmptyStateAction {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  testID?: string;
}

interface EmptyStateCardProps {
  /** Usually an EmptyIllustration. */
  illustration: ReactNode;
  /** A small tinted tag above the title — the "what this screen is for" line. */
  eyebrow?: string;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  /** A quieter text action under the primary one. */
  secondaryAction?: EmptyStateAction;
  /** Rendered under the actions, inside the card — chips, a short list. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The full empty state of a screen or section: picture, one line saying what
 * is missing, one saying why it matters, and the single action that fixes it.
 *
 * One action, deliberately. An empty screen is the moment a new User decides
 * whether the app is worth learning; a row of equal buttons hands that
 * decision back to them, where one clear "do this" makes it for them.
 */
export function EmptyStateCard({
  illustration,
  eyebrow,
  title,
  description,
  action,
  secondaryAction,
  children,
  style,
  testID,
}: EmptyStateCardProps) {
  const styles = useStyles();
  return (
    <View style={[styles.card, style]} testID={testID}>
      {illustration}
      <View style={styles.copy}>
        {eyebrow ? (
          <View style={styles.eyebrow}>
            <Text style={styles.eyebrowLabel}>{eyebrow}</Text>
          </View>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {action ? (
        <PillButton
          label={action.label}
          icon={action.icon}
          onPress={action.onPress}
          testID={action.testID}
          style={styles.action}
        />
      ) : null}
      {secondaryAction ? (
        <Pressable onPress={secondaryAction.onPress} hitSlop={8} testID={secondaryAction.testID} style={styles.secondary}>
          {secondaryAction.icon}
          <Text style={styles.secondaryLabel}>{secondaryAction.label}</Text>
        </Pressable>
      ) : null}
      {children}
    </View>
  );
}

interface EmptyInlineCardProps {
  icon: ReactNode;
  text: string;
  onPress?: () => void;
  testID?: string;
}

/** A section's own "nothing here yet" — small, so the section keeps its place. */
export function EmptyInlineCard({ icon, text, onPress, testID }: EmptyInlineCardProps) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      testID={testID}
      style={({ pressed }) => [styles.inline, pressed && styles.inlinePressed]}
    >
      <View style={styles.inlineIcon}>{icon}</View>
      <Text style={styles.inlineText}>{text}</Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.hero,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  copy: { alignItems: "center", gap: spacing.sm },
  eyebrow: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.green, 0.12),
  },
  eyebrowLabel: { ...typography.tiny, color: colors.green },
  title: { ...typography.title, color: colors.textPrimary, textAlign: "center" },
  description: { ...typography.label, fontWeight: "500", color: colors.textSecondary, textAlign: "center", lineHeight: 19 },
  action: { alignSelf: "stretch" },
  secondary: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: -spacing.xs },
  secondaryLabel: { ...typography.caption, color: colors.green },
  inline: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  inlinePressed: { opacity: 0.7 },
  inlineIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  inlineText: { ...typography.caption, color: colors.textSecondary, textAlign: "center" },
}));
