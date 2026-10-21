import { View } from "react-native";

import { RowSeparator } from "@/components/ui/grouped-list";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import {
  LIST_ROW_GAP,
  LIST_ROW_MIN_HEIGHT,
  LIST_ROW_PADDING_X,
  LIST_ROW_PADDING_Y,
  textInset,
} from "@/components/ui/grouped-list/list-metrics";
import { createStyles } from "@/lib/theme";

const AVATAR_SIZE = 36;

// Mirrors CategoryListItem as a row of a grouped list (36px avatar circle,
// ListRow's padding and hairline), so the loaded list lands where its
// placeholder was. Goes inside a ListSection.
export function CategoryListItemSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <RowSeparator inset={textInset(AVATAR_SIZE)} />
      <SkeletonBlock width={AVATAR_SIZE} height={AVATAR_SIZE} borderRadius={AVATAR_SIZE / 2} />
      <View style={styles.info}>
        <SkeletonBlock width="55%" height={15} />
      </View>
    </View>
  );
}

const useStyles = createStyles(() => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: LIST_ROW_GAP,
    minHeight: LIST_ROW_MIN_HEIGHT,
    paddingHorizontal: LIST_ROW_PADDING_X,
    paddingVertical: LIST_ROW_PADDING_Y,
  },
  info: { flex: 1 },
}));
