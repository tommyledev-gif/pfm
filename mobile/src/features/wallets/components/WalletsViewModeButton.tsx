import { useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { CardsThreeIcon } from "phosphor-react-native/src/icons/CardsThree";
import { RowsIcon } from "phosphor-react-native/src/icons/Rows";

import { ActionPopover, PopoverAnchor } from "@/components/shared/ActionPopover";
import { radii, createStyles, useColors } from "@/lib/theme";
import { WalletsViewMode } from "@/stores/ui-prefs-store";

// ScreenHeader's back button size, so the header row keeps its height.
const BUTTON_SIZE = 36;

const MODE_ICON = { carousel: CardsThreeIcon, list: RowsIcon } as const;

interface WalletsViewModeButtonProps {
  mode: WalletsViewMode;
  onChange: (mode: WalletsViewMode) => void;
}

/**
 * The Wallets screen's top-right button: how the User's own wallets are
 * drawn. Shows the current way, and opens a column of the two icons, cards or
 * grouped by type, the current one tinted. Icons only: each says what it is,
 * and screen readers get its name.
 */
export function WalletsViewModeButton({ mode, onChange }: WalletsViewModeButtonProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const ref = useRef<View>(null);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const Current = MODE_ICON[mode];

  // Page coordinates (measure), as ActionPopover's anchor requires.
  const open = () =>
    ref.current?.measure((_x, _y, width, height, pageX, pageY) => setAnchor({ x: pageX, y: pageY, width, height }));

  return (
    <>
      <Pressable
        ref={ref}
        testID="btn-wallets-view-mode"
        accessibilityRole="button"
        accessibilityLabel={t("wallets.view.change")}
        onPress={open}
        hitSlop={6}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Current size={20} color={colors.textPrimary} weight="bold" />
      </Pressable>
      <ActionPopover
        visible={anchor !== null}
        anchor={anchor}
        align="right"
        iconOnly
        onClose={() => setAnchor(null)}
        actions={(["carousel", "list"] as const).map((value) => ({
          Icon: MODE_ICON[value],
          label: t(value === "carousel" ? "wallets.view.carousel" : "wallets.view.list"),
          selected: value === mode,
          onPress: () => onChange(value),
          testID: `menu-wallets-view-${value}`,
        }))}
      />
    </>
  );
}

const useStyles = createStyles((colors) => ({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.6 },
}));
