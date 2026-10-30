import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { PressableScale } from "@/components/motion/PressableScale";
import { CheckIcon } from "@/components/ui/Icon";
import { readableInk, withAlpha } from "@/lib/color";
import { radii, spacing, typography, walletAccentPalette, walletCardInk, createStyles, useColors } from "@/lib/theme";
import { WALLET_COLORS, WalletColorKey } from "@/lib/wallet-colors";

const SWATCH_SIZE = 40;

interface WalletColorPickerProps {
  /** null = automatic (picked from the wallet's position). */
  value: WalletColorKey | null;
  onChange: (value: WalletColorKey | null) => void;
}

/**
 * The card colour row in the wallet form (SRS Feature-03 US-07). Each swatch
 * shows "Aa" in the ink the card will use on it, so the readable text is part
 * of what is being chosen, not a surprise on the card.
 */
export function WalletColorPicker({ value, onChange }: WalletColorPickerProps) {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();

  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      <PressableScale
        onPress={() => onChange(null)}
        style={[styles.swatch, styles.auto, value === null && styles.selected]}
        accessibilityRole="radio"
        accessibilityState={{ selected: value === null }}
        accessibilityLabel={t("wallets.form.colour.auto")}
        testID="swatch-wallet-color-auto"
      >
        {/* Four of the automatic colours as quarters: "one of these". */}
        <View style={styles.quarters}>
          {walletAccentPalette.slice(0, 4).map((c) => (
            <View key={c} style={[styles.quarter, { backgroundColor: c }]} />
          ))}
        </View>
        {value === null ? (
          <View style={styles.autoCheck}>
            <CheckIcon size={14} color={colors.onGreen} strokeWidth={3} />
          </View>
        ) : null}
      </PressableScale>

      {WALLET_COLORS.map(({ key, label, face }) => {
        const ink = readableInk(face, walletCardInk.dark, walletCardInk.light);
        const selected = value === key;
        return (
          <PressableScale
            key={key}
            onPress={() => onChange(key)}
            style={[styles.swatch, { backgroundColor: face }, selected && styles.selected]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            testID={`swatch-wallet-color-${key}`}
          >
            {selected ? (
              <CheckIcon size={16} color={ink} strokeWidth={3} />
            ) : (
              <Text style={[styles.sample, { color: ink }]}>Aa</Text>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  // A ring in the screen's own text colour, with a gap of background between
  // it and the swatch, reads as "picked" on every colour, light or deep.
  selected: { borderColor: colors.textPrimary },
  auto: { backgroundColor: withAlpha(colors.overlayBase, 0.06) },
  quarters: { width: SWATCH_SIZE - 8, height: SWATCH_SIZE - 8, borderRadius: radii.pill, overflow: "hidden", flexDirection: "row", flexWrap: "wrap" },
  quarter: { width: "50%", height: "50%" },
  autoCheck: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: withAlpha(colors.green, 0.85),
  },
  sample: { ...typography.caption, fontWeight: "700" },
}));
