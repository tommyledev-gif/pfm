

import { spacing, typography, createStyles } from "@/lib/theme";

// Shared by both chat panes (recording and analysis) so the two
// conversations look like one screen with two tabs, not two screens.
export const useChatThreadStyles = createStyles((colors) => ({
  list: { flex: 1 },
  // paddingVertical, not paddingBottom: `inverted` mirrors the content
  // container, so a bottom-only pad would end up above the oldest message
  // instead of below the newest one.
  thread: { paddingHorizontal: spacing.xl, gap: spacing.md, paddingVertical: spacing.md, flexGrow: 1 },
  hint: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xxl },
  typingRow: { alignItems: "flex-start" },
}));
