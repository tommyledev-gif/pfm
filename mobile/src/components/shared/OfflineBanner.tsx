import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BALL_TOP, PILL_HEIGHT } from "@/components/shared/bottom-nav-styles";
import { useIsOnline } from "@/lib/connectivity";
import { OFFLINE_BANNER_SHOW_DELAY_MS } from "@/lib/constants";
import { formatTime } from "@/lib/format-date";
import { createStyles, radii, spacing, typography } from "@/lib/theme";
import { useOutboxCount } from "@/stores/outbox-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";

interface OfflineBannerProps {
  // Whether the BottomNav is currently rendered beneath the banner.
  navVisible: boolean;
  // Dock under the status bar instead of at the bottom — for screens whose
  // own input floats right above the nav (AI Chat), where a bottom banner
  // would sit on top of it.
  dockTop: boolean;
}

const OFFLINE_LABEL = "Đang ngoại tuyến";
const LAST_UPDATED_LABEL = "dữ liệu lúc";
const SEPARATOR = " · ";
const queuedLabel = (count: number) => `${count} giao dịch chờ đồng bộ`;
// The "last updated" time stands for the whole saved snapshot; Wallets are
// what every main screen leads with, so their fetch time is the reference.
const LAST_UPDATED_QUERY_KEY = ["wallets"] as const;
// The nav's ball rises above the bar's top edge by -BALL_TOP; clear it too.
const NAV_CLEARANCE = PILL_HEIGHT - BALL_TOP + spacing.xs;

// Slim offline pill shown on every signed-in screen (specs/mobile-offline-
// support US-02, AC-OFF-05) — rendered once in app/(app)/_layout.tsx rather
// than in each screen, so no screen's own layout changes. Purely
// informational: pointerEvents "none" so it never swallows a tap meant for
// the content beneath it.
export function OfflineBanner({ navVisible, dockTop }: OfflineBannerProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const isOnline = useIsOnline();
  const queryClient = useQueryClient();
  const queuedCount = useOutboxCount(useCurrentUserId());
  const [showOffline, setShowOffline] = useState(false);

  const lastUpdatedMs = Math.max(
    0,
    ...queryClient.getQueryCache().findAll({ queryKey: LAST_UPDATED_QUERY_KEY }).map((q) => q.state.dataUpdatedAt),
  );
  // S-OFF-13: the waiting count joins the line only while there is one.
  const message = [
    OFFLINE_LABEL,
    lastUpdatedMs > 0 ? `${LAST_UPDATED_LABEL} ${formatLastUpdated(lastUpdatedMs)}` : null,
    queuedCount > 0 ? queuedLabel(queuedCount) : null,
  ]
    .filter(Boolean)
    .join(SEPARATOR);
  const position = dockTop
    ? { top: insets.top + spacing.xs }
    : { bottom: (navVisible ? NAV_CLEARANCE : spacing.sm) + insets.bottom };

  // Shown only once offline has lasted a moment, hidden at once on
  // reconnect — a flapping connection never makes it flicker (EC-OFF-04).
  useEffect(() => {
    if (isOnline) {
      setShowOffline(false);
      return;
    }
    const timer = setTimeout(() => setShowOffline(true), OFFLINE_BANNER_SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isOnline]);

  if (!showOffline) return null;

  return (
    <View style={[styles.wrapper, position]} pointerEvents="none">
      <View style={styles.pill} testID="banner-offline">
        <View style={styles.dot} />
        <Text style={styles.text} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </View>
  );
}

// "HH:mm" when the data is from today, "dd/MM HH:mm" otherwise — an older
// snapshot must not read as if it were from this morning.
function formatLastUpdated(ms: number): string {
  const date = new Date(ms);
  const iso = date.toISOString();
  if (date.toDateString() === new Date().toDateString()) return formatTime(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month} ${formatTime(iso)}`;
}

const DOT_SIZE = 8;

const useStyles = createStyles((colors) => ({
  // left/right 0 + alignItems center: an absolute view without an explicit
  // left is centred by Yoga via the parent's alignment instead.
  wrapper: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    maxWidth: "90%",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, backgroundColor: colors.warning },
  text: { ...typography.caption, color: colors.textPrimary, flexShrink: 1 },
}));
