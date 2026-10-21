import { useRef, useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";

import { MotionView } from "@/components/motion/MotionView";
import { ListGlyph, ListRow, ListSection } from "@/components/ui/grouped-list";
import {
  DeveloperGlyph,
  HelpGlyph,
  HistoryGlyph,
  MembersGlyph,
  ShieldGlyph,
  SignOutGlyph,
  TagGlyph,
  UserSettingsGlyph,
  WalletGlyph,
} from "@/components/ui/grouped-list/list-icons";
import { BusyOverlay } from "@/components/shared/BusyOverlay";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { type Palette, spacing, createStyles, useColors } from "@/lib/theme";
import { useSessionStore } from "@/stores/session-store";
import { outboxItemsFor } from "@/stores/outbox-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { LogoutGuardDialog } from "@/features/settings/components/LogoutGuardDialog";
import { ProfileSummaryCard } from "@/features/settings/components/ProfileSummaryCard";
import { AccountSwitchRow } from "@/features/accounts/components/AccountSwitchRow";
import { useLogout } from "@/features/accounts/hooks/use-logout";

type SettingsHref =
  | "/wallets"
  | "/categories"
  | "/audit-logs"
  | "/security"
  | "/user-settings"
  | "/users"
  | "/developer"
  | "/edit-profile";

interface SettingsRow {
  label: string;
  icon: ListGlyph;
  /** The tile's palette token; none = a neutral grey tile. */
  tone?: keyof Palette;
  href: SettingsHref | null;
  adminOnly?: boolean;
  testID?: string;
}

// Help & Support has no mobile screen yet — out of the design
// handoff's scope (it maps them as entry points only). Wallets/Categories/
// Household Members now navigate to real management screens.
//
// `adminOnly` rows are filtered out entirely (not disabled) for a member —
// Household Members is the mobile UI for F-01's invite/list flow, whose
// endpoints live under /admin/* behind `RequireRole("admin")`, so a member
// tapping it would only ever land on a screen whose every request 403s.
// The server-side gate remains the actual authorization boundary; this is
// just not advertising a door the user can't open.
//
// Grouped the way iOS Settings groups: money first, then the account, then
// the rest; switching and signing out close the list in a group of their own.
const SETTINGS_GROUPS: { header: string; rows: SettingsRow[] }[] = [
  {
    header: "Tài chính",
    rows: [
      { label: "Ví của bạn", icon: WalletGlyph, tone: "info", href: "/wallets" },
      { label: "Danh mục", icon: TagGlyph, tone: "mustard", href: "/categories" },
      { label: "Nhật ký giao dịch", icon: HistoryGlyph, tone: "lavender", href: "/audit-logs" },
    ],
  },
  {
    header: "Tài khoản",
    rows: [
      { label: "Bảo mật", icon: ShieldGlyph, tone: "mint", href: "/security", testID: "row-settings-security" },
      // How the app looks and behaves for this User; its own screen lists them.
      {
        label: "Cài đặt người dùng",
        icon: UserSettingsGlyph,
        tone: "periwinkle",
        href: "/user-settings",
        testID: "row-settings-user",
      },
      { label: "Thành viên gia đình", icon: MembersGlyph, tone: "green", href: "/users", adminOnly: true },
    ],
  },
  {
    header: "Khác",
    rows: [
      { label: "Trợ giúp & hỗ trợ", icon: HelpGlyph, tone: "info", href: null },
      { label: "Nhà phát triển", icon: DeveloperGlyph, href: "/developer" },
    ],
  },
];
const EDIT_PROFILE_HREF = "/edit-profile" as const;
// Taps on a menu row closer together than this count as one.
const ROW_TAP_GUARD_MS = 600;
// Clears the floating bottom nav, so the last group is never hidden under it.
const BOTTOM_NAV_CLEARANCE = 140;

export default function SettingsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const lastPushAt = useRef(0);
  const role = useSessionStore((s) => s.role);
  const userId = useCurrentUserId();
  const [logoutGuardOpen, setLogoutGuardOpen] = useState(false);
  const { loggingOut, logout } = useLogout();

  // One push per burst of taps: a quick double tap fires twice before the
  // route has changed, and would otherwise stack the same screen twice.
  const openRow = (href: SettingsHref) => {
    const now = Date.now();
    if (now - lastPushAt.current < ROW_TAP_GUARD_MS) return;
    lastPushAt.current = now;
    router.push(href);
  };

  // Unsynced Transactions first get a choice (specs/mobile-offline-support US-07).
  const requestLogout = () => (outboxItemsFor(userId).length > 0 ? setLogoutGuardOpen(true) : logout());

  const groups = SETTINGS_GROUPS.map((group) => ({
    ...group,
    rows: group.rows.filter((row) => !row.adminOnly || role === "admin"),
  })).filter((group) => group.rows.length > 0);

  const renderRow = ({ label, icon, tone, href, testID }: SettingsRow) => (
    <ListRow
      key={label}
      title={label}
      icon={icon}
      tone={tone ? colors[tone] : undefined}
      onPress={href ? () => openRow(href) : undefined}
      disabled={!href}
      testID={testID}
    />
  );

  return (
    <Screen>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ScreenHeader title="Cài đặt" onBack={false} style={styles.header} />

        {/* Groups stagger in top to bottom on the first visit; the tab stays
            mounted afterwards, so coming back does not replay it. */}
        <MotionView index={0}>
          <ProfileSummaryCard onOpenProfile={() => openRow(EDIT_PROFILE_HREF)} />
        </MotionView>

        {groups.map((group, index) => (
          <MotionView key={group.header} index={index + 1}>
            <ListSection header={group.header}>{group.rows.map(renderRow)}</ListSection>
          </MotionView>
        ))}

        <MotionView index={groups.length + 1}>
          <ListSection>
            {/* Directly above "Đăng xuất" (specs/mobile-account-switch AC-05). */}
            <AccountSwitchRow />
            <ListRow
              title={loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
              icon={SignOutGlyph}
              tone={colors.peach}
              variant="destructive"
              onPress={requestLogout}
              loading={loggingOut}
              testID="btn-settings-logout"
            />
          </ListSection>
        </MotionView>
      </ScrollView>

      {/* Logout: flush + server calls run up to LOGOUT_FLUSH_TIMEOUT_MS
          (features/accounts/hooks/use-logout.ts); nothing may be tapped
          meanwhile — the row's own spinner says what is happening. */}
      <LogoutGuardDialog
        visible={logoutGuardOpen && !loggingOut}
        onCancel={() => setLogoutGuardOpen(false)}
        onLogout={() => {
          setLogoutGuardOpen(false);
          logout();
        }}
      />
      <BusyOverlay visible={loggingOut} testID="overlay-settings-logout" />
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingHorizontal: spacing.xl, paddingBottom: BOTTOM_NAV_CLEARANCE, gap: spacing.xxl },
  // The content already pads the sides; the title lines up with the cards.
  header: { paddingHorizontal: 0, paddingBottom: 0 },
}));
