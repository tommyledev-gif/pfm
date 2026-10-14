import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ChevronDownIcon, LockIcon, WalletIcon } from "@/components/ui/Icon";
import { colorForCategory } from "@/lib/category-color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { Wallet } from "@/features/wallets/types";

interface WalletPickerFieldProps {
  /** What the field is for, spoken before the value ("Ví", "Đến ví"). */
  label: string;
  wallet: Wallet | null;
  /** How many wallets the list behind it offers. */
  count: number;
  placeholder: string;
  onPress: () => void;
  /** Cannot change for this transaction: a lock replaces the arrow. */
  locked?: boolean;
  testID?: string;
}

const AVATAR_SIZE = 28;
const ICON_SIZE = 16;
const MIN_HEIGHT = 52;

/**
 * The wallet as one compact bar (an iOS menu button), not a row of chips:
 * the chosen wallet's icon and name, how many there are to pick from, and an
 * arrow. Tapping it opens the wallet list (useWalletPickerPanel).
 */
export function WalletPickerField({ label, wallet, count, placeholder, onPress, locked, testID }: WalletPickerFieldProps) {
  const colors = useColors();
  const styles = useStyles();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${wallet?.name ?? placeholder}`}
      accessibilityState={{ disabled: Boolean(locked) }}
      style={({ pressed }) => [styles.field, pressed && styles.pressed]}
    >
      {wallet ? (
        <Avatar name={wallet.name} color={colorForCategory(wallet.id)} size={AVATAR_SIZE} icon={wallet.icon} iconUrl={wallet.icon_url} />
      ) : (
        <View style={styles.emptyIcon}>
          <WalletIcon size={ICON_SIZE} color={colors.textMuted} />
        </View>
      )}
      <Text style={[styles.name, !wallet && styles.placeholder]} numberOfLines={1}>
        {wallet?.name ?? placeholder}
      </Text>
      {locked ? null : <Text style={styles.count}>{count} ví</Text>}
      {locked ? (
        <LockIcon size={ICON_SIZE} color={colors.textMuted} />
      ) : (
        <ChevronDownIcon size={ICON_SIZE} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  field: {
    minHeight: MIN_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.listCard,
    backgroundColor: colors.fieldFill,
  },
  pressed: { opacity: 0.7 },
  emptyIcon: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.controlTrack,
  },
  // minWidth 0: a long wallet name ellipsizes instead of pushing the count out.
  name: { flex: 1, minWidth: 0, ...typography.body, color: colors.textPrimary },
  placeholder: { color: colors.textMuted, fontWeight: "500" },
  count: { ...typography.caption, fontWeight: "500", color: colors.textMuted },
}));
