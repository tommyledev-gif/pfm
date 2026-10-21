import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";

import { MotionStagger } from "@/components/motion/MotionStagger";
import { EmptyStateCard } from "@/components/shared/EmptyState";
import { PillButton } from "@/components/ui/PillButton";
import { CheckIcon, LockIcon, PlusIcon, TargetIcon, WalletIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors, useThemeDefinition } from "@/lib/theme";
import { OnboardingStep, OnboardingStepKey, buildOnboardingSteps } from "@/features/onboarding/onboarding-steps";
import { useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";

// Rasterised from assets/app-img/*-empty_home.svg (traced artwork, ~100k
// paths — far too heavy for react-native-svg), background keyed out to
// transparent so it sits on either theme's card. Both share one size.
const ILLUSTRATION = {
  light: require("../../../../assets/app-img/light-empty-home.webp"),
  dark: require("../../../../assets/app-img/dark-empty-home.webp"),
};
const ILLUSTRATION_ASPECT_RATIO = 982 / 547;
// The steps start entering once the card above them has begun to.
const STEPS_DELAY_MS = 120;

interface HomeOnboardingCardProps {
  hasWallet: boolean;
  hasTransaction: boolean;
  hasBudget: boolean;
  /** Home owns the transaction form, so that one step is handed back to it. */
  onAddTransaction: () => void;
}

/**
 * Home for an account with nothing in it yet — in place of the period
 * snapshot, which would only be a ring of zeros. A welcome, the three steps
 * that make the rest of the app light up, and one button for whichever step
 * is next.
 */
export function HomeOnboardingCard({ hasWallet, hasTransaction, hasBudget, onAddTransaction }: HomeOnboardingCardProps) {
  const colors = useColors();
  const styles = useStyles();
  const { isDark } = useThemeDefinition();
  const router = useRouter();
  const openWalletCreator = useOpenWalletCreator();
  const onAction = (step: OnboardingStepKey) => {
    if (step === "wallet") openWalletCreator();
    else if (step === "transaction") onAddTransaction();
    // The Budgets tab's own empty state takes it from there — the guided
    // wizard is one tap away on it.
    else router.push({ pathname: "/insights", params: { tab: "Budgets" } });
  };
  const { steps, completed, active } = buildOnboardingSteps({
    wallet: hasWallet,
    transaction: hasTransaction,
    budget: hasBudget,
  });
  const ctaIcon = {
    wallet: <WalletIcon size={18} color={colors.onGreen} />,
    transaction: <PlusIcon size={18} color={colors.onGreen} />,
    budget: <TargetIcon size={18} color={colors.onGreen} />,
  };

  return (
    <View style={styles.container} testID="card-home-onboarding">
      <EmptyStateCard
        illustration={
          <Image
            source={isDark ? ILLUSTRATION.dark : ILLUSTRATION.light}
            style={styles.illustration}
            contentFit="contain"
            accessible={false}
          />
        }
        title="Biết tiền đi đâu"
        description="Ghi thu chi, đặt ngân sách theo danh mục."
      />

      <View style={styles.journeyHeader}>
        <Text style={styles.journeyTitle}>Xong {completed}/3 bước</Text>
      </View>

      {/* The steps follow the card in, one after another. */}
      <View style={styles.steps}>
        <MotionStagger delay={STEPS_DELAY_MS}>
          {steps.map((step, index) => (
            <StepRow key={step.key} step={step} index={index} onPress={() => onAction(step.key)} />
          ))}
        </MotionStagger>
      </View>

      {active ? (
        <PillButton
          label={active.cta}
          icon={ctaIcon[active.key]}
          onPress={() => onAction(active.key)}
          testID={`btn-onboarding-${active.key}`}
        />
      ) : null}
    </View>
  );
}

function StepRow({ step, index, onPress }: { step: OnboardingStep; index: number; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  const isActive = step.status === "active";
  const isDone = step.status === "done";
  const isLocked = step.status === "locked";

  return (
    <Pressable
      onPress={onPress}
      disabled={!isActive}
      accessibilityRole={isActive ? "button" : undefined}
      accessibilityState={{ disabled: !isActive }}
      testID={`row-onboarding-${step.key}`}
      style={({ pressed }) => [
        styles.row,
        isActive && styles.rowActive,
        isLocked && styles.rowLocked,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.marker, isActive && styles.markerActive, isDone && styles.markerDone]}>
        {isDone ? (
          <CheckIcon size={14} color={colors.onGreen} strokeWidth={2.6} />
        ) : isLocked ? (
          <LockIcon size={14} color={colors.textMuted} />
        ) : (
          <Text style={styles.markerNumber}>{index + 1}</Text>
        )}
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowTitleLine}>
          <Text style={[styles.rowTitle, isDone && styles.rowTitleDone]} numberOfLines={1}>
            {step.title}
          </Text>
          {/* A View pill around one line of text, never shrunk: the padding,
              tint and radius used to sit on the Text itself, which Android
              measured too narrow beside the shrinking title — "Cần làm"
              wrapped to "Cần" and a blank gap. */}
          <View style={[styles.badge, isActive && styles.badgeActive]}>
            <Text
              style={[styles.badgeLabel, isActive || isDone ? styles.badgeLabelGreen : styles.badgeLabelMuted]}
              numberOfLines={1}
            >
              {isActive ? "Cần làm" : isDone ? "Xong" : `Bước ${index + 1}`}
            </Text>
          </View>
        </View>
        <Text style={styles.rowDescription}>{step.description}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  container: { gap: spacing.md },
  illustration: { width: "100%", aspectRatio: ILLUSTRATION_ASPECT_RATIO },
  journeyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  journeyTitle: { ...typography.caption, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  journeyTag: { ...typography.caption, color: colors.green },
  steps: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.listCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
  rowActive: { borderColor: withAlpha(colors.green, 0.35), backgroundColor: withAlpha(colors.green, 0.05) },
  rowLocked: { opacity: 0.55 },
  rowPressed: { opacity: 0.8 },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  markerActive: { backgroundColor: colors.green },
  markerDone: { backgroundColor: withAlpha(colors.green, 0.7) },
  markerNumber: { ...typography.label, fontWeight: "800", color: colors.onGreen },
  rowText: { flex: 1, gap: 2 },
  rowTitleLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  rowTitle: { ...typography.body, color: colors.textPrimary, flexShrink: 1 },
  rowTitleDone: { color: colors.textSecondary },
  rowDescription: { ...typography.caption, fontWeight: "500", color: colors.textSecondary, lineHeight: 17 },
  // Same padding in every state, so the three labels line up on the right.
  badge: { flexShrink: 0, paddingVertical: 2, paddingHorizontal: spacing.sm, borderRadius: radii.pill },
  badgeActive: { backgroundColor: withAlpha(colors.green, 0.12) },
  badgeLabel: { ...typography.tiny },
  badgeLabelGreen: { color: colors.green },
  badgeLabelMuted: { color: colors.textMuted },
}));
