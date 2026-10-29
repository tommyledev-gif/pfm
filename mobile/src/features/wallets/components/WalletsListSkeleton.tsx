import { View } from "react-native";

import { ListSection, RowSeparator } from "@/components/ui/grouped-list";
import {
  LIST_ROW_GAP,
  LIST_ROW_MIN_HEIGHT,
  LIST_ROW_PADDING_X,
  LIST_ROW_PADDING_Y,
  textInset,
} from "@/components/ui/grouped-list/list-metrics";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { spacing, createStyles } from "@/lib/theme";

const AVATAR_SIZE = 40; // WalletListItem's
const GROUPS = [3, 2];

// The Wallets screen's list views ("Theo nhóm", "Ví chung") while the
// wallets load: two inset groups of WalletListItem-shaped rows, in place of
// the spinner that used to stand in for the whole screen.
export function WalletsListSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.list}>
      {GROUPS.map((rows, group) => (
        <View key={group} style={styles.group}>
          <SkeletonBlock width={90} height={12} style={styles.header} />
          <ListSection>
            {Array.from({ length: rows }).map((_, i) => (
              <View key={i} style={styles.row}>
                <RowSeparator inset={textInset(AVATAR_SIZE)} />
                <SkeletonBlock width={AVATAR_SIZE} height={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} />
                <View style={styles.info}>
                  <SkeletonBlock width="50%" height={14} />
                  <SkeletonBlock width="30%" height={11} />
                </View>
                <SkeletonBlock width={72} height={14} />
              </View>
            ))}
          </ListSection>
        </View>
      ))}
    </View>
  );
}

const useStyles = createStyles(() => ({
  list: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  group: { gap: spacing.sm },
  header: { marginLeft: LIST_ROW_PADDING_X },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: LIST_ROW_GAP,
    minHeight: LIST_ROW_MIN_HEIGHT,
    paddingHorizontal: LIST_ROW_PADDING_X,
    paddingVertical: LIST_ROW_PADDING_Y,
  },
  info: { flex: 1, gap: 6 },
}));
