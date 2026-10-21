import { ReactNode } from "react";

import { Toggle } from "@/components/ui/Toggle";
import { ListRow } from "@/components/ui/grouped-list/ListRow";
import { ListGlyph } from "@/components/ui/grouped-list/list-metrics";

interface ListToggleRowProps {
  /** Names what is on while the switch is on ("Khóa ứng dụng"). */
  title: string;
  subtitle?: string;
  icon?: ListGlyph;
  tone?: string;
  leading?: ReactNode;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Greys the switch out (e.g. while a check it started is running). */
  disabled?: boolean;
  /** Read out for the switch. Defaults to the title. */
  accessibilityLabel?: string;
  /** The switch's own testID, which is what a test taps. */
  testID?: string;
}

/**
 * A settings row whose trailing control is the app's Toggle. Only the switch
 * takes the tap, as on iOS: a row that flips when brushed while scrolling
 * would be worse for a switch that can lock the app.
 */
export function ListToggleRow({
  title,
  subtitle,
  icon,
  tone,
  leading,
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
  testID,
}: ListToggleRowProps) {
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      icon={icon}
      tone={tone}
      leading={leading}
      trailing={
        <Toggle
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          accessibilityLabel={accessibilityLabel ?? title}
          testID={testID}
        />
      }
    />
  );
}
