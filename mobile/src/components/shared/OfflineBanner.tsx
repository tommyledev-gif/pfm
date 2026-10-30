import { memo, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { OfflineInfoSheet } from "@/components/shared/OfflineInfoSheet";
import { CheckIcon, ChevronRightIcon, WifiOffIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { ConnectionStripState, useConnectionStrip } from "@/lib/connection-strip";
import { createStyles, spacing, typography, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { useOutboxCount } from "@/stores/outbox-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";

const STRIP_HEIGHT = 28;
const RESIZE_MS = 220;

// Worded as the User's own state (user request, 2026-10-29): a bare
// "Ngoại tuyến" read as a label, not as something about this phone.
const OFFLINE_LABEL_KEY = "ui.offline.strip" as const;
const RECONNECTED_LABEL_KEY = "ui.offline.reconnected" as const;

type VisibleState = Exclude<ConnectionStripState, "hidden">;

/**
 * The offline strip (specs/mobile-offline-support US-02, AC-OFF-05): a thin
 * full-width band right under the status bar, in the layout — it pushes the
 * screen down rather than floating over it. Rendered by Screen.tsx, so every
 * signed-in screen has it without a line of its own.
 *
 * ⚠️ It replaced a floating pill docked above the BottomNav (plan Finding
 * #12). Offline is a lasting state, not a toast: floating, the pill fought
 * the Fab and the nav for the same corner, covered the end of every list,
 * and lost — its right edge sat under the Fab.
 *
 * Says only "Bạn đang ngoại tuyến", plus the waiting count when there is one (S-OFF-13).
 * A tap opens OfflineInfoSheet with the saved data's time and the actions
 * that need a network. On reconnect it turns green for a moment, then folds
 * away by animating its height. Timing (and flapping, EC-OFF-04) is
 * lib/connection-strip.ts.
 */
export const OfflineBanner = memo(function OfflineBanner() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const status = useConnectionStrip();
  const queuedCount = useOutboxCount(useCurrentUserId());
  // Read when needed, not subscribed to: useIsFocused re-rendered the strip
  // of both screens on every tab switch.
  const navigation = useNavigation();
  const reduceMotion = useReduceMotion();
  const [sheetOpen, setSheetOpen] = useState(false);
  const visible = status !== "hidden";

  // What the strip shows while folding away: the last visible state, not an
  // empty band. Adjusted during render, React's pattern for derived state.
  const [shown, setShown] = useState<VisibleState>(visible ? status : "offline");
  if (visible && status !== shown) setShown(status);
  const offline = shown === "offline";
  const label = offline
    ? queuedCount > 0
      ? t("ui.offline.stripQueued", { count: queuedCount })
      : t(OFFLINE_LABEL_KEY)
    : t(RECONNECTED_LABEL_KEY);

  // Starts at its target, so a screen opened while offline has the strip
  // already in place — only a change of state moves anything.
  const height = useSharedValue(visible ? STRIP_HEIGHT : 0);
  useEffect(() => {
    const target = visible ? STRIP_HEIGHT : 0;
    // Only the screen in view animates; every other mounted tab just settles.
    height.value =
      reduceMotion || !navigation.isFocused() ? target : withTiming(target, { duration: RESIZE_MS, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduceMotion, height]);
  const heightStyle = useAnimatedStyle(() => ({ height: height.value }));

  // The sheet is about being offline — once back online it has nothing to say.
  useEffect(() => {
    if (status !== "offline") setSheetOpen(false);
  }, [status]);

  // Announced, rather than an accessibilityLiveRegion: every mounted screen
  // has its own strip (tabs stay mounted), so only the focused one may speak,
  // and only on an actual change — not each time a screen is opened.
  const previousStatus = useRef(status);
  useEffect(() => {
    const changed = previousStatus.current !== status;
    previousStatus.current = status;
    if (changed && navigation.isFocused() && status !== "hidden") {
      AccessibilityInfo.announceForAccessibility(t(status === "offline" ? OFFLINE_LABEL_KEY : RECONNECTED_LABEL_KEY));
    }
  }, [status, navigation, t]);

  return (
    <>
      <Animated.View
        style={[styles.strip, heightStyle]}
        accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      >
        <Pressable
          testID="banner-offline"
          onPress={() => setSheetOpen(true)}
          disabled={!offline || !visible}
          accessibilityRole={offline ? "button" : undefined}
          accessibilityLabel={label}
          accessibilityHint={offline ? t("ui.offline.openHint") : undefined}
          style={({ pressed }) => [
            styles.content,
            offline ? styles.contentOffline : styles.contentReconnected,
            pressed && styles.pressed,
          ]}
        >
          {offline ? (
            <WifiOffIcon size={13} color={colors.warning} />
          ) : (
            <CheckIcon size={13} color={colors.green} strokeWidth={2.6} />
          )}
          <Text style={[styles.label, offline ? styles.labelOffline : styles.labelReconnected]} numberOfLines={1}>
            {label}
          </Text>
          {offline ? <ChevronRightIcon size={12} color={withAlpha(colors.warning, 0.7)} /> : null}
        </Pressable>
      </Animated.View>
      {/* Outside the strip: the strip clips to its own height. */}
      <OfflineInfoSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} queuedCount={queuedCount} />
    </>
  );
});

const useStyles = createStyles((colors) => ({
  // Clips the content while the height animates, so the band folds shut
  // instead of squashing its text.
  strip: { overflow: "hidden" },
  content: {
    height: STRIP_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
  },
  // Amber, tinted rather than filled: a grey surface band read as part of
  // the screen and was missed (user, 2026-10-29). Amber is the usual "limited
  // connection" signal and stays clear of red, which here means an error.
  // `warning` has a darker light-theme value, so the text stays readable.
  contentOffline: {
    backgroundColor: withAlpha(colors.warning, 0.14),
    borderBottomColor: withAlpha(colors.warning, 0.3),
  },
  contentReconnected: {
    backgroundColor: withAlpha(colors.green, 0.12),
    borderBottomColor: withAlpha(colors.green, 0.25),
  },
  pressed: { opacity: 0.7 },
  label: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  labelOffline: { color: colors.warning, fontWeight: "600" },
  labelReconnected: { color: colors.green },
}));
