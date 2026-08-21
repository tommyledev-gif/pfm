import { useState } from "react";
import { FlatList, Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, radii, spacing, typography } from "@/lib/theme";
import { LogEntry, useDebugLogStore } from "@/stores/debug-log-store";

interface DebugLogViewerProps {
  visible: boolean;
  onClose: () => void;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour12: false });
}

function serializeLog(entries: LogEntry[]): string {
  return entries
    .map((e) => `[${formatTime(e.timestamp)}] (${e.category}) ${e.summary}${e.detail ? `\n${JSON.stringify(e.detail, null, 2)}` : ""}`)
    .join("\n\n");
}

// Fullscreen modal — the "display fullscreen là các log" half of
// specs/mobile-debug-console/spec.md. Reverse-chronological, newest first,
// tap an entry to expand its detail.
export function DebugLogViewer({ visible, onClose }: DebugLogViewerProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const entries = useDebugLogStore((s) => s.entries);
  const clear = useDebugLogStore((s) => s.clear);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const reversed = [...entries].reverse();

  async function handleShare() {
    await Share.share({ message: serializeLog(entries) || "No log entries yet." });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View testID="debug-log-viewer" style={[styles.container, { paddingTop: insets.top }]}>
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
          <Pressable testID="debug-log-clear-btn" style={styles.toolbarButton} onPress={clear}>
            <Text style={styles.actionLabel}>Clear</Text>
          </Pressable>
        </View>

        <FlatList
          data={reversed}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No log entries yet.</Text>}
          renderItem={({ item }) => (
            <Pressable
              testID={`debug-log-entry-${item.id}`}
              style={styles.row}
              onPress={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
            >
              <View style={styles.rowHeader}>
                <Text style={[styles.badge, styles[`badge_${item.category}`]]}>{item.category}</Text>
                <Text style={styles.time}>{formatTime(item.timestamp)}</Text>
              </View>
              <Text style={styles.summary}>{item.summary}</Text>
              {expandedId === item.id && item.detail ? (
                <Text style={styles.detail}>{JSON.stringify(item.detail, null, 2)}</Text>
              ) : null}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
});
