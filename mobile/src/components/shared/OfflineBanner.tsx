import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, Text } from "react-native";
import { useIsFocused } from "@react-navigation/native";
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

const OFFLINE_LABEL = "Ngoại tuyến";
const RECONNECTED_LABEL = "Đã kết nối lại · đang đồng bộ";
const OPEN_HINT = "Xem dữ liệu cập nhật lúc nào và thao tác nào cần mạng";

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
 * Says only "Ngoại tuyến", plus the waiting count when there is one (S-OFF-13).
 * A tap opens OfflineInfoSheet with the saved data's time and the actions
 * that need a network. On reconnect it turns green for a moment, then folds
 * away by animating its height. Timing (and flapping, EC-OFF-04) is
 * lib/connection-strip.ts.
 */
export function OfflineBanner() {
  const colors = useColors();
  const styles = useStyles();
  const status = useConnectionStrip();
  const queuedCount = useOutboxCount(useCurrentUserId());
  const focused = useIsFocused();
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
      ? `${OFFLINE_LABEL} · ${queuedCount} chờ đồng bộ`
      : OFFLINE_LABEL
    : RECONNECTED_LABEL;

  // Starts at its target, so a screen opened while offline has the strip
  // already in place — only a change of state moves anything.
  const height = useSharedValue(visible ? STRIP_HEIGHT : 0);
  useEffect(() => {
    const target = visible ? STRIP_HEIGHT : 0;
    height.value = reduceMotion
      ? target
      : withTiming(target, { duration: RESIZE_MS, easing: Easing.out(Easing.cubic) });
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
    if (changed && focused && status !== "hidden") {
      AccessibilityInfo.announceForAccessibility(status === "offline" ? OFFLINE_LABEL : RECONNECTED_LABEL);
    }
  }, [status, focused]);

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
          accessibilityHint={offline ? OPEN_HINT : undefined}
          style={({ pressed }) => [
            styles.content,
            offline ? styles.contentOffline : styles.contentReconnected,
            pressed && styles.pressed,
          ]}
        >
          {offline ? (
            <WifiOffIcon size={13} color={colors.textSecondary} />
          ) : (
            <CheckIcon size={13} color={colors.green} strokeWidth={2.6} />
          )}
          <Text style={[styles.label, !offline && styles.labelReconnected]} numberOfLines={1}>
            {label}
          </Text>
          {offline ? <ChevronRightIcon size={12} color={colors.textMuted} /> : null}
        </Pressable>
      </Animated.View>
      {/* Outside the strip: the strip clips to its own height. */}
      <OfflineInfoSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} queuedCount={queuedCount} />
    </>
  );
}

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
  // Surface, not a warning colour: switching the network off is something
  // the User did, not an error — and amber next to the brand green read as
  // an alarm.
  contentOffline: { backgroundColor: colors.surface, borderBottomColor: colors.surfaceBorder },
  contentReconnected: {
    backgroundColor: withAlpha(colors.green, 0.12),
    borderBottomColor: withAlpha(colors.green, 0.25),
  },
  pressed: { opacity: 0.7 },
  label: { ...typography.caption, color: colors.textSecondary, flexShrink: 1 },
  labelReconnected: { color: colors.green },
}));
