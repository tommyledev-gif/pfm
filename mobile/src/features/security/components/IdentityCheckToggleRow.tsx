import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ListToggleRow } from "@/components/ui/grouped-list";
import { IdentityCheckGlyph } from "@/components/ui/grouped-list/list-icons";
import { TranslationKey } from "@/lib/i18n";
import { useColors } from "@/lib/theme";
import { useSecurityPrefsStore } from "@/stores/security-prefs-store";
import { CHANGE_SETTING_PROMPT, verifyOwner } from "@/features/security/identity-check";
import { PIN_COPY } from "@/features/security/pin/pin-copy";

/** The group footer under this row on the Security screen. */
export const IDENTITY_CHECK_FOOTER = "security.identityCheck.footer" satisfies TranslationKey;

/**
 * The device-wide identity-check switch (spec US-07). Turning it OFF first
 * asks for the check itself (AC-32) — otherwise whoever holds an unlocked
 * phone could simply switch it off; cancelled or failed keeps it on. A phone
 * with no lock at all lets it go off. Turning it ON needs nothing.
 */
export function IdentityCheckToggleRow() {
  const { t } = useTranslation();
  const colors = useColors();
  const enabled = useSecurityPrefsStore((s) => s.identityCheckEnabled);
  const setEnabled = useSecurityPrefsStore((s) => s.setIdentityCheckEnabled);
  const [checking, setChecking] = useState(false);

  const onChange = async (next: boolean) => {
    if (next) {
      setEnabled(true);
      return;
    }
    setChecking(true);
    try {
      const result = await verifyOwner(PIN_COPY.enter, CHANGE_SETTING_PROMPT);
      if (result === "passed" || result === "unavailable") setEnabled(false);
    } finally {
      setChecking(false);
    }
  };

  return (
    <ListToggleRow
      title={t("security.identityCheck.title")}
      icon={IdentityCheckGlyph}
      tone={colors.mint}
      value={enabled}
      onValueChange={onChange}
      disabled={checking}
      testID="switch-identity-check"
    />
  );
}
