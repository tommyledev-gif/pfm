import { ReactNode } from "react";

import { FieldError } from "@/components/ui/FieldError";
import { ListRow } from "@/components/ui/grouped-list";
import { LockGlyph } from "@/components/ui/grouped-list/list-icons";
import { ListGlyph } from "@/components/ui/grouped-list/list-metrics";
import { useColors } from "@/lib/theme";

interface EntryTileProps {
  label: string;
  /** The current value, on the right ("Tiền mặt", "2 món"). */
  summary: string;
  /** Second line under the label (a total, "Đã dời, chưa lưu"). */
  detail?: string;
  /** Nothing chosen yet: the value turns green, an invitation to tap. */
  muted?: boolean;
  glyph: ListGlyph;
  /** The icon tile's colour once something is chosen; grey while empty. */
  tone?: string;
  /** Replaces the icon tile (a wallet's own avatar, a map thumbnail). */
  leading?: ReactNode;
  leadingWidth?: number;
  onPress: () => void;
  /** Cannot open now (still loading). The chevron stays. */
  disabled?: boolean;
  /** Cannot open at all for this transaction: a lock replaces the chevron. */
  locked?: boolean;
  error?: string;
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * A form's door to a panel, as a row of an inset group (ListSection onSheet):
 * icon tile, what it is, the current value in grey on the right, a chevron —
 * the iOS Settings / Reminders detail row. It used to be a label over a
 * bordered tile, each one its own box; a group of rows reads as one set of
 * choices, and the chevron says which line opens something.
 */
export function EntryTile({
  label,
  summary,
  detail,
  muted,
  glyph,
  tone,
  leading,
  leadingWidth,
  onPress,
  disabled,
  locked,
  error,
  testID,
  accessibilityLabel,
}: EntryTileProps) {
  const colors = useColors();
  return (
    <ListRow
      title={label}
      subtitle={detail}
      subtitleLines={1}
      value={summary}
      valueColor={muted ? colors.green : undefined}
      icon={glyph}
      tone={muted ? undefined : tone}
      leading={leading}
      leadingWidth={leadingWidth}
      onPress={locked ? undefined : onPress}
      disabled={disabled}
      chevron={!locked}
      trailing={locked ? <LockGlyph size={15} weight="bold" color={colors.textMuted} /> : undefined}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {error ? <FieldError message={error} /> : null}
    </ListRow>
  );
}
