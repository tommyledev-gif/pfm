import { Text, View } from "react-native";

import { UsersIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { radii, typography, createStyles, useColors } from "@/lib/theme";

/**
 * "Ví chung" as a small tag, for lists that mix the User's own wallets with
 * shared ones: a quiet tint, not a filled pill, so it marks the row without
 * outweighing it. Green with the people glyph, as on WalletMiniCard's badge.
 */
export function SharedWalletTag({ testID }: { testID?: string }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <View style={styles.tag} testID={testID}>
      <UsersIcon size={11} color={colors.green} strokeWidth={2.4} />
      <Text style={styles.label}>Ví chung</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.green, 0.13),
  },
  label: { ...typography.tiny, fontWeight: "600", color: colors.green },
}));
