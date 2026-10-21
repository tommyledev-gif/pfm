import { useEffect } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ToastGlyph, toastAccent } from "@/components/shared/toast-glyphs";
import { useToastMotion } from "@/components/shared/use-toast-motion";
import { CloseIcon } from "@/components/ui/Icon";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { withAlpha } from "@/lib/color";
import { radii, spacing, createStyles, useColors } from "@/lib/theme";
import { useReduceMotion } from "@/lib/use-reduce-motion";
import { useToastStore } from "@/stores/toast-store";

const CLOSE_LABEL = "Đóng thông báo";
const CARD_MARGIN = spacing.xl;
// A phone-width card; on a tablet it stops growing instead of spanning the screen.
const MAX_CARD_WIDTH = 480;
const WELL_SIZE = 44;
const BADGE_SIZE = 22;
const GLYPH_SIZE = 14;
const CARD_PAD = 10;
// Concentric with the icon well, so a one-line toast is a full capsule; a
// taller one keeps the same corners instead of turning into a lozenge.
const CARD_RADIUS = WELL_SIZE / 2 + CARD_PAD;
const CLOSE_SIZE = 28;
const RING_STROKE = 2;
const WELL_ALPHA = 0.14;

/**
 * The app's one toast: a capsule card under the status bar, a tinted circle
 * holding the variant's badge (error and warning "!", info "i", success a
 * check), the message (up to 3 lines), an optional coloured action line, and
 * a close button ringed by the time left before it closes on its own.
 *
 * Mounted once in app/_layout.tsx and driven globally via useToastStore (see
 * that file's doc comment). Motion lives in use-toast-motion: a spring in from
 * just above, swipe up or aside to dismiss, and a show() while one is up
 * replaces it in place.
 */
export function Toast() {
  const colors = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const visible = useToastStore((s) => s.visible);
  const message = useToastStore((s) => s.message);
  const variant = useToastStore((s) => s.variant);
  const title = useToastStore((s) => s.title);
  const action = useToastStore((s) => s.action);
  const token = useToastStore((s) => s.token);
  const hide = useToastStore((s) => s.hide);

  const cardWidth = Math.min(windowWidth - CARD_MARGIN * 2, MAX_CARD_WIDTH);
  const motion = useToastMotion({ token, visible, cardWidth, reduceMotion, onHidden: hide });
  const accent = toastAccent(variant, colors);
  const spoken = title ? `${title}. ${message}` : message;

  // Android reads the live region below; iOS has none, so it is told.
  useEffect(() => {
    if (visible && token > 0 && Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(spoken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const runAction = () => {
    // Closed first: an action that shows a toast of its own ("Đã hoàn tác")
    // replaces this one instead of being closed with it.
    motion.dismiss("up");
    action?.onPress();
  };

  return (
    <View
      pointerEvents="box-none"
      accessibilityLiveRegion="polite"
      style={[styles.container, { top: insets.top + spacing.sm }]}
    >
      {visible ? (
        <Animated.View
          style={[styles.card, { width: cardWidth, shadowColor: accent }, motion.cardStyle]}
          {...motion.panHandlers}
        >
          <View
            style={[styles.well, { backgroundColor: withAlpha(accent, WELL_ALPHA) }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Animated.View style={[styles.badge, { backgroundColor: accent }, motion.badgeStyle]}>
              {/* The card's own surface, punched through the badge: dark on the
                  dark theme's light accents, white on the light theme's deep ones. */}
              <ToastGlyph variant={variant} size={GLYPH_SIZE} color={colors.surface} />
            </Animated.View>
          </View>

          <View style={styles.body}>
            <View accessible accessibilityRole="alert" accessibilityLabel={spoken}>
              {title ? (
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
              ) : null}
              <Text style={title ? styles.detail : styles.message} numberOfLines={3}>
                {message}
              </Text>
            </View>
            {action ? (
              <Pressable
                onPress={runAction}
                hitSlop={{ top: 6, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => [styles.actionHit, pressed && styles.pressed]}
              >
                <Text style={[styles.action, { color: accent }]} numberOfLines={1}>
                  {action.label}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => motion.dismiss("up")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={CLOSE_LABEL}
            style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
          >
            {/* The time left before it closes itself, as a ring that empties.
                It stops while the card is dragged. */}
            {reduceMotion ? null : (
              <ProgressRing
                progress={motion.countdown}
                size={CLOSE_SIZE}
                strokeWidth={RING_STROKE}
                color={withAlpha(accent, 0.6)}
                trackColor={withAlpha(colors.overlayBase, 0.06)}
              />
            )}
            <View style={styles.closeGlyph}>
              <CloseIcon size={12} color={colors.textMuted} strokeWidth={2.4} />
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // Always mounted, empty while hidden: TalkBack announces a toast appearing
  // inside a live region, not a live region appearing.
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10000,
    elevation: 10000,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: WELL_SIZE + CARD_PAD * 2,
    paddingVertical: CARD_PAD,
    paddingLeft: CARD_PAD,
    // Centres the close button on the right-hand curve, as the well is on the left.
    paddingRight: CARD_RADIUS - CLOSE_SIZE / 2,
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceBorder,
    // Tinted by the variant (shadowColor, inline): a soft coloured lift reads
    // on the dark ground too, where a black shadow disappears.
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  well: {
    width: WELL_SIZE,
    height: WELL_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, justifyContent: "center", gap: 2 },
  message: { fontSize: 14, fontWeight: "500", lineHeight: 19, color: colors.textPrimary },
  title: { fontSize: 14, fontWeight: "700", lineHeight: 19, color: colors.textPrimary },
  detail: { fontSize: 13, fontWeight: "500", lineHeight: 18, color: colors.textSecondary },
  actionHit: { alignSelf: "flex-start" },
  action: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  pressed: { opacity: 0.6 },
  close: {
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: radii.pill,
  },
  closePressed: { backgroundColor: withAlpha(colors.overlayBase, 0.08) },
  closeGlyph: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
}));
