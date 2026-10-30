import { useTranslation } from "react-i18next";

import { ListToggleRow } from "@/components/ui/grouped-list";
import { MapPinGlyph } from "@/components/ui/grouped-list/list-icons";
import { TranslationKey } from "@/lib/i18n";
import { useColors } from "@/lib/theme";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";

/** The group footer under this row: the one thing the title does not say (a key). */
export const PIN_LOCATION_FOOTER: TranslationKey = "userSettings.pinLocation.footer";

// Settings' default for the new-Transaction form's location switch, as a
// row of Cài đặt người dùng's grouped list. Same store field and testID as
// transactions/components/PinLocationPreferenceRow, which drew it as a card
// of its own.
export function PinLocationDefaultRow() {
  const { t } = useTranslation();
  const colors = useColors();
  const enabled = useUiPrefsStore((s) => s.pinLocationByDefault);
  const setEnabled = useUiPrefsStore((s) => s.setPinLocationByDefault);

  return (
    <ListToggleRow
      title={t("userSettings.pinLocation.title")}
      icon={MapPinGlyph}
      // Not peach: in this app red means destructive or spending.
      tone={colors.mint}
      value={enabled}
      onValueChange={setEnabled}
      testID="switch-settings-pin-location"
    />
  );
}
