import { useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Avatar } from "@/components/ui/Avatar";
import {
  ChevronRightIcon,
  CodeIcon,
  HelpIcon,
  HistoryIcon,
  LogOutIcon,
  PaletteIcon,
  ShieldIcon,
  TagIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { RevealableAmount } from "@/components/shared/RevealableAmount";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useSessionStore } from "@/stores/session-store";
import { useChatStore } from "@/stores/chat-store";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { totalBalance } from "@/features/wallets/wallet-totals";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";

// Security/Help & Support have no mobile screens yet — out of the design
// handoff's scope (it maps them as entry points only). Wallets/Categories/
// Household Members now navigate to real management screens.
//
// `adminOnly` rows are filtered out entirely (not disabled) for a member —
// Household Members is the mobile UI for F-01's invite/list flow, whose
// endpoints live under /admin/* behind `RequireRole("admin")`, so a member
// tapping it would only ever land on a screen whose every request 403s.
// The server-side gate remains the actual authorization boundary; this is
// just not advertising a door the user can't open.
const SETTINGS_ROWS = [
  { label: "Giao diện", Icon: PaletteIcon, href: "/appearance" as const, adminOnly: false, testID: "row-settings-appearance" },
  { label: "Ví của bạn", Icon: WalletIcon, href: "/wallets" as const, adminOnly: false },
  { label: "Danh mục", Icon: TagIcon, href: "/categories" as const, adminOnly: false },
  { label: "Thành viên gia đình", Icon: UsersIcon, href: "/users" as const, adminOnly: true },
  { label: "Nhật ký giao dịch", Icon: HistoryIcon, href: "/audit-logs" as const, adminOnly: false },
  { label: "Bảo mật", Icon: ShieldIcon, href: null, adminOnly: false },
  { label: "Trợ giúp & hỗ trợ", Icon: HelpIcon, href: null, adminOnly: false },
  { label: "Nhà phát triển", Icon: CodeIcon, href: "/developer" as const, adminOnly: false },
];
type SettingsHref = NonNullable<(typeof SETTINGS_ROWS)[number]["href"]>;
// Taps on a menu row closer together than this count as one.
const ROW_TAP_GUARD_MS = 600;

const LOGOUT_FLUSH_TIMEOUT_MS = 4000;
// Dims the app enough to read as "busy, hands off", not so much that the
// logout button's own spinner — the only progress shown — is lost under it.
const LOGOUT_OVERLAY_ALPHA = 0.55;
const LOGOUT_BUSY_OPACITY = 0.7;

function displayNameFromEmail(email: string | null): string {
  if (!email) return "Thành viên";
  const local = email.split("@")[0] ?? email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export default function SettingsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const lastPushAt = useRef(0);
  const email = useSessionStore((s) => s.email);
  const role = useSessionStore((s) => s.role);
  const clearSession = useSessionStore((s) => s.clear);
  const clearChat = useChatStore((s) => s.clear);
  const [loggingOut, setLoggingOut] = useState(false);
  const wallets = useWalletsQuery();
  const summary = useReportSummaryQuery();
  const name = displayNameFromEmail(email);

  const netWorth = wallets.data ? totalBalance(wallets.data) : null;
  const primaryTotal = summary.data?.totals[0];

  // Gives chat-store.ts's debounced autosave one last chance to land on the
  // server before clearChat() wipes the local copy — capped at
  // LOGOUT_FLUSH_TIMEOUT_MS so a flaky/offline network never makes tapping
  // "Log out" feel stuck (apiClient's own request timeout is 15s, far too
  // long to block a logout button on).
  //
  // While it runs, the whole app sits under an overlay and the button shows
  // its own spinner: the flush can take up to that timeout, and a screen that
  // still reacted to taps in the meantime invited a second logout, a
  // navigation away, or an edit that the wipe was about to throw away.
  // One push per burst of taps: a quick double tap fires twice before the
  // route has changed, and would otherwise stack the same screen twice.
  const openRow = (href: SettingsHref) => {
    const now = Date.now();
    if (now - lastPushAt.current < ROW_TAP_GUARD_MS) return;
    lastPushAt.current = now;
    router.push(href);
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await Promise.race([
        useChatStore.getState().flushSync(),
        new Promise((resolve) => setTimeout(resolve, LOGOUT_FLUSH_TIMEOUT_MS)),
      ]);
    } catch {
      // Best-effort — proceed with logout either way; the next login
      // restores whatever the server last had via GET /ai/chat/thread.
    }
    clearChat();
    clearSession();
  };

  return (
    <Screen>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.identity}>
        <Avatar name={name} size={72} fallback="initial" />
        <Text style={styles.name}>{name}</Text>
        {email ? <Text style={styles.email}>{email}</Text> : null}
      </View>

      <View style={styles.statRow}>
        {/* Compacted, because three figures share one row: a fully-grouped
            net worth shrank to unreadable or clipped mid-number here. The
            exact figure is a one-second hold away on each — anywhere on the
            card, not just its figure (see RevealableAmount). */}
        <RevealableAmount
          label="Tài sản ròng"
          amountCents={netWorth ? netWorth.amount : null}
          currency={netWorth?.currency ?? "VND"}
          containerStyle={styles.statCard}
          labelStyle={styles.statLabel}
          style={styles.statValue}
          testID="text-settings-net-worth"
        />
        <RevealableAmount
          label="Thu nhập"
          amountCents={primaryTotal ? primaryTotal.total_income : null}
          currency={primaryTotal?.currency ?? "VND"}
          containerStyle={styles.statCard}
          labelStyle={styles.statLabel}
          style={[styles.statValue, { color: colors.green }]}
          testID="text-settings-income"
        />
        <RevealableAmount
          label="Chi tiêu"
          amountCents={primaryTotal ? primaryTotal.total_expense : null}
          currency={primaryTotal?.currency ?? "VND"}
          containerStyle={styles.statCard}
          labelStyle={styles.statLabel}
          style={[styles.statValue, { color: colors.peach }]}
          testID="text-settings-expense"
        />
      </View>

      <View style={styles.settingsGroup}>
        {SETTINGS_ROWS.filter((row) => !row.adminOnly || role === "admin").map(({ label, Icon, href, testID }) => (
          <Pressable
            key={label}
            testID={testID}
            style={styles.row}
            onPress={href ? () => openRow(href) : undefined}
            disabled={!href}
          >
            <Icon size={20} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>{label}</Text>
            <ChevronRightIcon size={18} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.logoutRow, loggingOut && styles.logoutRowBusy]}
        onPress={logout}
        disabled={loggingOut}
        accessibilityRole="button"
        accessibilityState={{ disabled: loggingOut, busy: loggingOut }}
        testID="btn-settings-logout"
      >
        {loggingOut ? <ActivityIndicator size="small" color={colors.peach} /> : <LogOutIcon size={20} />}
        <Text style={styles.logoutLabel}>{loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</Text>
      </Pressable>
    </ScrollView>

    {/* A Modal, not an absolute View: it has to cover the bottom nav too,
        which this screen does not own. No content of its own — the button's
        spinner, still visible through it, is what says what is happening.
        Back does nothing while it is up: logout cannot be cancelled half-way. */}
    <Modal visible={loggingOut} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.logoutOverlay} testID="overlay-settings-logout" />
    </Modal>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 140, gap: spacing.xl },
  identity: { alignItems: "center", gap: spacing.xs },
  name: { ...typography.title, color: colors.textPrimary, marginTop: spacing.sm },
  email: { ...typography.caption, color: colors.textSecondary },
  statRow: { flexDirection: "row", gap: spacing.sm },
  // Card's own surface/border/radius (components/ui/Card.tsx), applied to the
  // hold target itself so the whole card is what gets held.
  statCard: {
    flex: 1,
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.card,
  },
  statLabel: { ...typography.tiny, color: colors.textSecondary },
  statValue: { ...typography.label, color: colors.textPrimary },
  settingsGroup: { gap: spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
  },
  rowLabel: { flex: 1, ...typography.body, color: colors.textPrimary },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: withAlpha(colors.peach, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(colors.peach, 0.35),
    borderRadius: 16,
  },
  logoutRowBusy: { opacity: LOGOUT_BUSY_OPACITY },
  logoutLabel: { ...typography.body, color: colors.peach },
  logoutOverlay: { flex: 1, backgroundColor: withAlpha(colors.bgApp, LOGOUT_OVERLAY_ALPHA) },
}));
