import { View } from "react-native";

import { MapPinIcon } from "@/components/ui/Icon";
import { createStyles, spacing, useColors } from "@/lib/theme";
import { ItemsEditor } from "@/features/transactions/items/use-items-editor";
import { EntryTile } from "@/features/transactions/components/EntryTile";
import { ItemsEntryRow } from "@/features/transactions/components/ItemsEntryRow";

/** What the "Vị trí" tile shows; built by whoever owns the location state. */
export interface LocationTileView {
  summary: string;
  detail?: string;
  muted: boolean;
  pinned: boolean;
  /** No pin and none can be added any more (a saved transaction). */
  locked: boolean;
  accessibilityLabel: string;
}

interface TransactionExtrasRowProps {
  location: LocationTileView;
  onPressLocation: () => void;
  lines: ItemsEditor;
  currency: string;
  onPressItems: () => void;
  itemsError?: string;
  /** The manual form editing a saved one: its count until the lines load, and
   *  the tile held shut while they do. The AI chat's sheet has neither. */
  itemsPendingCount?: number;
  itemsLoading?: boolean;
  // Hides the items tile (a transfer has no items); the location tile then
  // keeps its half width so it does not jump in size.
  showItems?: boolean;
}

const ICON_SIZE = 16;

/**
 * "Vị trí" and "Các món" side by side, equal width: the two optional extras
 * of a transaction, each opening its own panel in the sheet. Same tile look
 * as the full-width "Các món" row of the manual form.
 */
export function TransactionExtrasRow({
  location,
  onPressLocation,
  lines,
  currency,
  onPressItems,
  itemsError,
  itemsPendingCount = 0,
  itemsLoading = false,
  showItems = true,
}: TransactionExtrasRowProps) {
  const colors = useColors();
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <EntryTile
        compact
        label="Vị trí"
        summary={location.summary}
        // detail={location.detail}
        muted={location.muted}
        locked={location.locked}
        icon={<MapPinIcon size={ICON_SIZE} color={location.pinned ? colors.accentMuted : colors.textMuted} />}
        onPress={onPressLocation}
        testID="btn-edit-location-tile"
        accessibilityLabel={location.accessibilityLabel}
      />
      {showItems ? (
        <ItemsEntryRow
          compact
          lines={lines}
          currency={currency}
          pendingCount={itemsPendingCount}
          loading={itemsLoading}
          onPress={onPressItems}
          error={itemsError}
        />
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const useStyles = createStyles(() => ({
  // flex-start: an error under one tile must not stretch the other one.
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  placeholder: { flex: 1 },
}));
