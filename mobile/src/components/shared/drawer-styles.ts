import { StyleSheet } from "react-native";

import { OFFSCREEN_Y } from "@/components/shared/use-drawer-motion";
import { radii, spacing, createStyles } from "@/lib/theme";

// Drawer's styles, split out of Drawer.tsx for the 300-line cap.
export const useDrawerStyles = createStyles((colors) => ({
  anchor: { position: "absolute", left: 0, top: 0, width: 0, height: 0 },
  overlay: { position: "absolute", zIndex: 1000, elevation: 1000 },
  // Softer than it was (0.6): it now comes in with the sheet, not ahead of it.
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  backdrop: { flex: 1, justifyContent: "flex-end" },
  // Resting: never past 92%, which always clears the status bar.
  sheetTouchArea: { maxHeight: "92%" },
  // ⚠️ Full screen: the whole screen, top edge included. It used to stop
  // under a status-bar padding on the backdrop, and with the rounded corners
  // and the handle strip under that, "full" still left a strip of dimmed
  // screen showing — about a tenth of a phone with a tall status bar or a
  // cutout. The content keeps clear of the bar through its own top padding.
  // The scroll area takes the extra room, so a pinned footer stays at the
  // bottom. Reached by transforms, not by animating this (useSheetExpand).
  sheetTouchAreaExpanded: { height: "100%", maxHeight: "100%" },
  sheetSlide: { flexShrink: 1 },
  // flexGrow, never `flex: 1`, over styles that set flexShrink/flexGrow
  // themselves (see sheetScrollFull).
  fill: { flexGrow: 1 },
  // A whole window tall: a full-screen sheet gliding back to a short one
  // leaves nearly that much under it on the way down.
  skirt: { position: "absolute", left: 0, right: 0, top: "50%", height: OFFSCREEN_Y, backgroundColor: colors.surface },
  // Clips the layers to the sheet's own box. Its background is the separate
  // `background` layer, so the body and the background can move apart while
  // the sheet goes full screen (useSheetExpand).
  sheetSurface: { flexShrink: 1, overflow: "hidden" },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.hero,
    borderTopRightRadius: radii.hero,
  },
  // Full screen, the background starts a corner's radius above the top edge,
  // so its rounded corners sit off screen: square at the top, nothing of the
  // dim showing in the corners.
  backgroundFull: { top: -radii.hero },
  content: { flexShrink: 1 },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  // ⚠️ flexGrow, not `flex: 1`: Yoga lets an explicit flexGrow (sheetScroll's
  // 0) win over the `flex` shorthand, so full screen the body kept its
  // content height and was cut off above an empty band (emulator 2026-11-11).
  sheetScrollFull: { flexGrow: 1 },
  // Top padding is small because SheetHandle's strip already sits above it.
  sheet: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, paddingTop: spacing.sm, gap: spacing.md },
  // Opaque: while the sheet goes full screen the body is drawn lowered for a
  // moment, and the footer covers its lower part.
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    backgroundColor: colors.surface,
  },
}));
