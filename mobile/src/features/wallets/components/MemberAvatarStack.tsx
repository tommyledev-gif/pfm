import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { colorForCategory } from "@/lib/category-color";
import { withAlpha } from "@/lib/color";
import { createStyles, typography } from "@/lib/theme";
import { WalletMember } from "@/features/wallets/types";

const MAX_VISIBLE = 4;
const OVERLAP = 8;
const RING = 2;

interface MemberAvatarStackProps {
  members: WalletMember[];
  size?: number;
}

/**
 * The people in a shared wallet as overlapping initials, owner first (the
 * order GET /members returns), then a "+N" for the rest. An invitation not
 * yet answered is drawn faded: invited, not in yet. Each person keeps one
 * colour everywhere (colorForCategory keyed by user id).
 */
export function MemberAvatarStack({ members, size = 26 }: MemberAvatarStackProps) {
  const styles = useStyles();
  const visible = members.slice(0, MAX_VISIBLE);
  const overflow = members.length - visible.length;
  const ringed = size + RING * 2;
  return (
    <View style={styles.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {visible.map((member, index) => (
        <View
          key={member.user_id}
          style={[
            styles.ring,
            { width: ringed, height: ringed, borderRadius: ringed / 2 },
            index > 0 && { marginLeft: -OVERLAP },
            member.status === "pending" && styles.pending,
          ]}
        >
          <Avatar name={member.name} color={colorForCategory(member.user_id)} size={size} fallback="initial" />
        </View>
      ))}
      {overflow > 0 ? (
        <View style={[styles.ring, { width: ringed, height: ringed, borderRadius: ringed / 2, marginLeft: -OVERLAP }]}>
          <View style={[styles.more, { width: size, height: size, borderRadius: size / 2 }]}>
            <Text style={styles.moreLabel}>{`+${overflow}`}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center" },
  // The ring in the card's own colour is what separates two overlapping circles.
  ring: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  pending: { opacity: 0.45 },
  more: { alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(colors.overlayBase, 0.12) },
  moreLabel: { ...typography.tiny, fontWeight: "700", color: colors.textSecondary },
}));
