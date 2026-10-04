import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { AVATAR_GROUP_MAX_VISIBLE } from "@/lib/constants";
import { colorForCategory } from "@/lib/category-color";
import { createStyles, typography, useThemeDefinition } from "@/lib/theme";
import { accountDisplayName } from "@/features/accounts/account-registry-store";
import { SavedAccount } from "@/features/accounts/types";

interface AvatarGroupProps {
  /** Active account first (the caller orders them). */
  accounts: SavedAccount[];
}

const AVATAR_SIZE = 28;
// Each avatar tucks under the previous one by this much.
const OVERLAP = 10;
// The ring in the page colour is what separates two overlapping circles.
const RING_WIDTH = 2;

/**
 * Overlapping initials for the Settings switch row (spec AC-05): at most
 * AVATAR_GROUP_MAX_VISIBLE avatars, then a dark "+N" circle where
 * N = accounts − AVATAR_GROUP_MAX_VISIBLE.
 */
export function AvatarGroup({ accounts }: AvatarGroupProps) {
  const styles = useStyles();
  const { isDark } = useThemeDefinition();
  const visible = accounts.slice(0, AVATAR_GROUP_MAX_VISIBLE);
  const overflow = accounts.length - visible.length;

  return (
    <View style={styles.group} testID="avatar-group-accounts">
      {visible.map((account, index) => (
        <View key={account.userId} style={[styles.ring, index > 0 && styles.overlapped]}>
          <Avatar
            name={accountDisplayName(account)}
            color={colorForCategory(account.userId)}
            size={AVATAR_SIZE}
            fallback="initial"
          />
        </View>
      ))}
      {overflow > 0 ? (
        <View style={[styles.ring, styles.overlapped]}>
          <View style={[styles.overflow, !isDark && styles.overflowOnLight]}>
            <Text style={[styles.overflowLabel, !isDark && styles.overflowLabelOnLight]} testID="text-avatar-group-overflow">{`+${overflow}`}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  group: { flexDirection: "row", alignItems: "center" },
  ring: {
    borderRadius: (AVATAR_SIZE + RING_WIDTH * 2) / 2,
    borderWidth: RING_WIDTH,
    borderColor: colors.surface,
  },
  overlapped: { marginLeft: -OVERLAP },
  overflow: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceRaised,
  },
  // The "+N" circle stays dark in both themes (spec decision #5).
  overflowOnLight: { backgroundColor: colors.textPrimary },
  overflowLabel: { ...typography.tiny, fontWeight: "700", color: colors.textPrimary },
  overflowLabelOnLight: { color: colors.surface },
}));
