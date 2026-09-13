import { ReactNode, useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CheckIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { colors, spacing, typography } from "@/lib/theme";

interface WizardStepSuccessProps {
  createdCount: number | null;
  /** Pre-formatted, e.g. "276.000đ". The one number worth carrying out of here. */
  dailyAllowance?: string;
  onDone: () => void;
}

// The choreography, in ms. One directed sequence rather than several effects
// firing at once, and it ENDS — anything that loops reads as "still loading",
// which is the opposite of what this screen is for.
const CHECK_DELAY = 140;
const TITLE_DELAY = 220;
const SUBTITLE_DELAY = 300;
const BUTTON_DELAY = 420;
const RISE_DURATION = 320;
const HALO_DURATION = 620;

/**
 * The end of the wizard — a landing, not another step.
 *
 * ⚠️ Every animation here runs on `useNativeDriver: true`, and that is not an
 * optimisation. The moment this mounts, the submit's query invalidation is
 * re-rendering the budget screens behind it, so the JS thread is at its busiest
 * exactly when the sequence plays. Anything driven from JS — LayoutAnimation, or
 * `useNativeDriver: false` — drops frames precisely here and the result looks
 * cheaper than no animation at all. Only opacity and transform are animated,
 * which is what lets the native driver take them.
 *
 * The 140ms offset between the circle landing and the tick appearing is the
 * whole effect: together they read as "appeared", staggered they read as
 * "finished". The rest of the sequence just gets out of the way.
 *
 * NOTE: a success haptic at the tick would complete this, but expo-haptics is a
 * native module and adding it forces a dev-client rebuild — deliberately left
 * out rather than bundled in unannounced. The one call site is marked below.
 */
export function WizardStepSuccess({ createdCount, dailyAllowance, onDone }: WizardStepSuccessProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();

  const settled = reduceMotion ? 1 : 0;
  const circleScale = useRef(new Animated.Value(reduceMotion ? 1 : 0.7)).current;
  const circleFade = useRef(new Animated.Value(settled)).current;
  const check = useRef(new Animated.Value(settled)).current;
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) return;

    Animated.parallel([
      Animated.timing(circleFade, { toValue: 1, duration: 160, useNativeDriver: true }),
      // Physics config, not tension/friction: a small overshoot is what makes it
      // read as landing rather than fading in.
      Animated.spring(circleScale, { toValue: 1, damping: 12, stiffness: 180, mass: 0.6, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(CHECK_DELAY),
        Animated.spring(check, { toValue: 1, damping: 9, stiffness: 240, mass: 0.5, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(CHECK_DELAY),
        // One expansion, then gone. No loop.
        Animated.timing(halo, { toValue: 1, duration: HALO_DURATION, useNativeDriver: true }),
      ]),
    ]).start();

    // Haptics.notificationAsync(Success) belongs on this timer — fired with the
    // tick, not with the mount.
  }, [reduceMotion, circleFade, circleScale, check, halo]);

  const haloStyle = {
    opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
  };

  // ⚠️ `createdCount ?? 0` would render a failure as a success — nothing was
  // created, yet the screen would congratulate the user for it. The count is
  // only claimed when there genuinely is one.
  const hasCount = typeof createdCount === "number" && createdCount > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.center}>
        <View style={styles.badge}>
          <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />
          <Animated.View style={[styles.circle, { opacity: circleFade, transform: [{ scale: circleScale }] }]}>
            <Animated.View style={{ opacity: check, transform: [{ scale: check }] }}>
              <CheckIcon size={34} color={colors.green} />
            </Animated.View>
          </Animated.View>
        </View>

        {/* The per-day figure leads, and the count supports it. "Đã tạo 6 ngân
            sách" tells the user what the app just did; the đ/ngày tells them
            what they can now do — and this is the last thing they see before
            leaving, so it should be the thing they carry. */}
        <Rise delay={TITLE_DELAY} reduceMotion={reduceMotion}>
          <Text style={styles.title}>
            {dailyAllowance ? (
              <>
                Từ hôm nay bạn có <Text style={styles.amount}>{dailyAllowance}</Text> mỗi ngày
              </>
            ) : hasCount ? (
              `Đã tạo ${createdCount} ngân sách`
            ) : (
              "Đã lưu ngân sách"
            )}
          </Text>
        </Rise>

        {dailyAllowance && hasCount ? (
          <Rise delay={SUBTITLE_DELAY} reduceMotion={reduceMotion}>
            <Text style={styles.subtitle}>{createdCount} ngân sách đã sẵn sàng</Text>
          </Rise>
        ) : null}
      </View>

      {/* A footer action bar, not a stretched button in a centred column: the
          previous steps put their primary action at the bottom too, so full
          width here has the same reason it had there and the screen does not
          read as a stray dialog. */}
      <Rise delay={BUTTON_DELAY} rise={0} reduceMotion={reduceMotion}>
        <View style={styles.footer}>
          <PillButton label="Xong" onPress={onDone} />
        </View>
      </Rise>
    </View>
  );
}

/**
 * Fade in while drifting up a few pixels.
 *
 * Written by hand rather than using a preset entering animation: the presets are
 * easy to get backwards (a name describing where it comes FROM versus where it
 * goes TO), and being wrong by a sign inverts the whole feel.
 */
function Rise({
  delay,
  rise = 12,
  reduceMotion,
  children,
}: {
  delay: number;
  rise?: number;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(progress, { toValue: 1, duration: RISE_DURATION, useNativeDriver: true }),
    ]).start();
  }, [delay, reduceMotion, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [rise, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const BADGE_SIZE = 96;
const CIRCLE_SIZE = 76;

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  footer: { paddingTop: spacing.lg },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  halo: {
    position: "absolute",
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.green,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(133,255,51,0.12)",
  },
  title: { ...typography.title, color: colors.textPrimary, textAlign: "center" },
  amount: { color: colors.green },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
});
