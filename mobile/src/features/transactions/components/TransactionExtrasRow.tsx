import { ListSection } from "@/components/ui/grouped-list";
import { MapPinGlyph } from "@/components/ui/grouped-list/list-icons";
import { useColors } from "@/lib/theme";
import { ItemsEditor } from "@/features/transactions/items/use-items-editor";
import { EntryTile } from "@/features/transactions/components/EntryTile";
import { ItemsEntryRow } from "@/features/transactions/components/ItemsEntryRow";
import { TransactionLocationRow } from "@/features/transactions/components/TransactionLocationRow";
import { TransactionLocationInput } from "@/features/transactions/types";

/** What the "Vị trí" row shows; built by whoever owns the location state. */
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
   *  the row held shut while they do. The AI chat's sheet has neither. */
  itemsPendingCount?: number;
  itemsLoading?: boolean;
  /** Hides the items row: a transfer has no items. */
  showItems?: boolean;
  /** The pin as the sheet has it: its row then shows a small map of it. */
  pin?: TransactionLocationInput | null;
}

/**
 * The two optional extras of a transaction, as one inset group of rows, each
 * opening its own panel in the sheet: "Vị trí" (a small map once pinned) and
 * "Các món". They used to be two bordered half-width tiles side by side,
 * which read as two buttons more than as two settings of the transaction.
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
  pin,
}: TransactionExtrasRowProps) {
  const colors = useColors();
  return (
    <ListSection onSheet>
      {pin ? (
        <TransactionLocationRow pin={pin} tile={location} onPress={onPressLocation} />
      ) : (
        <EntryTile
          label="Vị trí"
          summary={location.muted ? "Thêm" : location.summary}
          muted={location.muted}
          locked={location.locked}
          glyph={MapPinGlyph}
          tone={colors.peach}
          onPress={onPressLocation}
          testID="btn-edit-location-tile"
          accessibilityLabel={location.accessibilityLabel}
        />
      )}
      {showItems ? (
        <ItemsEntryRow
          lines={lines}
          currency={currency}
          pendingCount={itemsPendingCount}
          loading={itemsLoading}
          onPress={onPressItems}
          error={itemsError}
        />
      ) : null}
    </ListSection>
  );
}
