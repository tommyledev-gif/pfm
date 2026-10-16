import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, ListRenderItemInfo, Modal, Pressable, Share, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radii, spacing, typography, createStyles } from "@/lib/theme";
import { LogEntry, useDebugLogStore } from "@/stores/debug-log-store";
import { useDebugTestAccountsStore } from "@/stores/debug-test-accounts-store";
import { useSessionStore } from "@/stores/session-store";
import { useLogout } from "@/features/accounts/hooks/use-logout";

interface DebugLogViewerProps {
  visible: boolean;
  onClose: () => void;
}

const NO_ENTRIES: LogEntry[] = [];
// An expanded entry shows at most this much of its detail. A Text holding a
// whole transactions response (hundreds of KB) takes seconds to lay out on
// Android and holds the JS thread while it does.
const DETAIL_MAX_CHARS = 20_000;
// Share goes through an Android intent, which fails past ~1 MB; the log is
// cut to the newest entries that fit well under that.
const SHARE_MAX_CHARS = 200_000;

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour12: false });
}

function stringifyDetail(detail: unknown, maxChars: number): string {
  const text = JSON.stringify(detail, null, 2) ?? "";
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n… (${text.length - maxChars} more chars)` : text;
}

// Newest first, stopping once the cap is reached.
function serializeLog(newestFirst: LogEntry[]): string {
  const parts: string[] = [];
  let size = 0;
  for (const e of newestFirst) {
    const part = `[${formatTime(e.timestamp)}] (${e.category}) ${e.summary}${e.detail ? `\n${stringifyDetail(e.detail, DETAIL_MAX_CHARS)}` : ""}`;
    if (size + part.length > SHARE_MAX_CHARS) {
      parts.push(`… ${newestFirst.length - parts.length} older entries not included`);
      break;
    }
    parts.push(part);
    size += part.length;
  }
  return parts.join("\n\n");
}

// Fullscreen modal — the "display fullscreen là các log" half of
// specs/mobile-debug-console/spec.md. Reverse-chronological, newest first,
// tap an entry to expand its detail.
//
// ⚠️ The list is a snapshot taken when the console opens, with a button for
// whatever arrived since. It used to be live: every API call (polling,
// refetches) prepended a row and re-rendered the whole list, so rows slid
// away under the finger and taps landed on nothing.
export function DebugLogViewer({ visible, onClose }: DebugLogViewerProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  // Not subscribed while closed: no re-render per API call in the background.
  const entries = useDebugLogStore((s) => (visible ? s.entries : NO_ENTRIES));
  const clear = useDebugLogStore((s) => s.clear);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  // Highest entry id shown; newer ones wait behind the "new entries" button.
  const [shownUntilId, setShownUntilId] = useState(0);
  const [wasVisible, setWasVisible] = useState(visible);
  const router = useRouter();
  const { logout, loggingOut } = useLogout();

  const handleShow = () => {
    setShownUntilId(useDebugLogStore.getState().entries.at(-1)?.id ?? 0);
    setExpandedId(null);
  };
  // The snapshot is taken as the console opens, during render, so the first
  // frame already shows it (React's adjust-state-on-prop-change pattern).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) handleShow();
  }

  // filter() copies, so reversing its result leaves the store's array alone.
  const shown = useMemo(() => entries.filter((e) => e.id <= shownUntilId).reverse(), [entries, shownUntilId]);
  const newCount = entries.length - shown.length;

  // Switching test accounts without typing: lists lib/dev-login.ts's
  // TEST_ACCOUNTS on the login screen, passwords filled in, and opens that
  // list there. Signed in, it signs out first (the auth guard then lands on
  // login, which opens the list itself).
  async function handleTestAccounts() {
    onClose();
    useDebugTestAccountsStore.getState().reveal();
    if (useSessionStore.getState().accessToken) await logout();
    else router.navigate("/login");
  }

  async function handleShare() {
    const newestFirst = [...useDebugLogStore.getState().entries].reverse();
    await Share.share({ message: serializeLog(newestFirst) || "No log entries yet." });
  }

  const handleClear = () => {
    clear();
    setExpandedId(null);
  };

  const toggle = useCallback((id: number) => setExpandedId((prev) => (prev === id ? null : id)), []);
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<LogEntry>) => (
      <LogRow entry={item} expanded={expandedId === item.id} onToggle={toggle} />
    ),
    [expandedId, toggle],
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      // Edge-to-edge like every other full-screen layer here, so the
      // safe-area padding below is the only offset.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View testID="debug-log-viewer" style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Debug Console</Text>
            <Text testID="debug-log-current-screen" style={styles.subtitle}>
              Screen: {pathname}
            </Text>
          </View>
          <Pressable testID="debug-log-close-btn" onPress={onClose} hitSlop={8}>
            <Text style={styles.actionLabel}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.toolbar}>
          <Pressable testID="debug-log-share-btn" style={styles.toolbarButton} onPress={handleShare}>
            <Text style={styles.actionLabel}>Share</Text>
          </Pressable>
          <Pressable testID="debug-log-clear-btn" style={styles.toolbarButton} onPress={handleClear}>
            <Text style={styles.actionLabel}>Clear</Text>
          </Pressable>
          <Pressable
            testID="debug-test-accounts-btn"
            style={styles.toolbarButton}
            onPress={handleTestAccounts}
            disabled={loggingOut}
          >
            <Text style={styles.actionLabel}>Test accounts</Text>
          </Pressable>
        </View>

        {newCount > 0 ? (
          <Pressable testID="debug-log-show-new-btn" style={styles.newButton} onPress={handleShow}>
            <Text style={styles.actionLabel}>Show {newCount} new</Text>
          </Pressable>
        ) : null}

        <FlatList
          data={shown}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={<Text style={styles.empty}>No log entries yet.</Text>}
        />
      </View>
    </Modal>
  );
}

interface LogRowProps {
  entry: LogEntry;
  expanded: boolean;
  onToggle: (id: number) => void;
}

// Memoised, and the detail is stringified only while expanded.
const LogRow = memo(function LogRow({ entry, expanded, onToggle }: LogRowProps) {
  const styles = useStyles();
  const detail = useMemo(
    () => (expanded && entry.detail ? stringifyDetail(entry.detail, DETAIL_MAX_CHARS) : null),
    [expanded, entry.detail],
  );
  return (
    <Pressable testID={`debug-log-entry-${entry.id}`} style={styles.row} onPress={() => onToggle(entry.id)}>
      <View style={styles.rowHeader}>
        <Text style={[styles.badge, styles[`badge_${entry.category}`]]}>{entry.category}</Text>
        <Text style={styles.time}>{formatTime(entry.timestamp)}</Text>
      </View>
      <Text style={styles.summary}>{entry.summary}</Text>
      {detail ? (
        <Text style={styles.detail} selectable>
          {detail}
        </Text>
      ) : null}
    </Pressable>
  );
});

const useStyles = createStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.bgApp },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerText: { gap: spacing.xs },
  title: { ...typography.title, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textSecondary },
  actionLabel: { ...typography.label, color: colors.green },
  toolbar: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  toolbarButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  newButton: {
    alignSelf: "center",
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
  },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    padding: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: spacing.xs,
  },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { ...typography.tiny, textTransform: "uppercase", paddingHorizontal: spacing.sm, borderRadius: radii.pill },
  badge_navigation: { color: colors.periwinkle },
  badge_api: { color: colors.mint },
  badge_error: { color: colors.peach },
  time: { ...typography.tiny, color: colors.textMuted },
  summary: { ...typography.label, color: colors.textPrimary },
  detail: { ...typography.tiny, color: colors.textSecondary, marginTop: spacing.xs },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
}));
