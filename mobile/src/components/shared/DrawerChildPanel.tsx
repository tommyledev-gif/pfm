import { ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

import { ChevronLeftIcon, CloseIcon } from "@/components/ui/Icon";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

interface DrawerChildPanelProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  // See DrawerChild.hideBack.
  hideBack?: boolean;
  // The overlay's own width, measured by Drawer — the panel parks exactly one
  // screen-width to the right when closed, so it is never partly visible at
  // rest regardless of device size.
  width: number;
  // Live keyboard height. The panel is a sibling of the sheet, not a child of
  // the backdrop that already pads for the keyboard, so it has to lift itself:
  // its whole point is holding a search field.
  bottomInset: number;
}

// How far down the overlay the panel starts. Matches Drawer's own 90% sheet
// cap, so the panel always fully covers the sheet it slid in over — a shorter
// panel would leave a strip of the parent form showing above it, which reads
// as two competing sheets rather than one step of the same flow.
const TOP_INSET = "10%";

// The sliding half of Drawer's `child` prop — see the DrawerChild doc comment
// there for why this lives on Drawer rather than being nested in its children.
// Rendered only by Drawer, which supplies the geometry.
//
// No grab bar and no drag (2026-10-14): the panel is a step of the sheet under
// it, not a sheet of its own, so dragging it down read as dismissing the whole
// form. Back returns to the parent sheet; X does too.
export function DrawerChildPanel({
  visible,
  onClose,
  title,
  children,
  footer,
  hideBack = false,
  width,
  bottomInset,
}: DrawerChildPanelProps) {
  const colors = useColors();
  const styles = useStyles();
  // Same keep-mounted-through-the-close-animation trick as Drawer itself:
  // unmounting on `visible === false` would make the panel vanish instead of
  // sliding back out.
  const [rendered, setRendered] = useState(visible);
  const translateX = useRef(new Animated.Value(visible ? 0 : width)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        mass: 0.9,
        stiffness: 220,
      }).start();
    } else {
      Animated.timing(translateX, { toValue: width, duration: 200, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, width]);

  if (!rendered) return null;

  return (
    <Animated.View
      style={[styles.panel, { bottom: bottomInset, transform: [{ translateX }] }]}
      // Nothing here should fall through to the backdrop underneath, which
      // would dismiss the parent sheet along with this panel.
      pointerEvents="box-none"
    >
      <View style={styles.surface}>
        <View style={styles.header}>
          {hideBack ? (
            // Keeps the title centred between equal sides.
            <View style={styles.backSpacer} />
          ) : (
            <Pressable onPress={onClose} hitSlop={10}>
              <ChevronLeftIcon size={20} color={colors.textPrimary} />
            </Pressable>
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <CloseIcon size={18} color={colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.body}>{children}</View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </Animated.View>
  );
}

const useStyles = createStyles((colors) => ({
  // elevation alongside zIndex: on Android the sibling backdrop can otherwise
  // paint over a later sibling regardless of document order.
  panel: { position: "absolute", left: 0, right: 0, top: TOP_INSET, zIndex: 1, elevation: 1 },
  surface: {
    flex: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.hero,
    borderTopRightRadius: radii.hero,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    // The same distance from the top edge the header had under the old grab
    // bar's strip, so the title does not jump up against the rounded corner.
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  // Centered between the two icon buttons, matching the reference sheet's
  // back / title / close header.
  title: { flex: 1, textAlign: "center", ...typography.cardTitle, color: colors.textPrimary },
  // The chevron's width, so a panel without it keeps a centred title.
  backSpacer: { width: 20 },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
  },
}));
