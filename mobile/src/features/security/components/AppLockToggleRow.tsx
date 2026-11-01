import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ListToggleRow } from "@/components/ui/grouped-list";
import { LockGlyph } from "@/components/ui/grouped-list/list-icons";
import { i18n, TranslationKey } from "@/lib/i18n";
import { useColors } from "@/lib/theme";
import { useSecurityPrefsStore } from "@/stores/security-prefs-store";
import { useToastStore } from "@/stores/toast-store";
import { CHANGE_SETTING_PROMPT, verifyOwner } from "@/features/security/identity-check";
import { PIN_COPY } from "@/features/security/pin/pin-copy";

/** The group footer under this row on the Security screen. */
export const APP_LOCK_FOOTER = "security.appLock.footer" satisfies TranslationKey;

/**
 * The device-wide app lock switch (US-12, default off). Both directions ask
 * for the owner check first: turning it on proves the check works on this
 * phone, turning it off must not be possible for whoever just picked the
 * phone up. A phone with neither a screen lock nor an app PIN cannot turn it
 * on (specs/mobile-app-pin BR-05); it can always turn it off.
 */
export function AppLockToggleRow() {
  const { t } = useTranslation();
  const colors = useColors();
  const enabled = useSecurityPrefsStore((s) => s.appLockEnabled);
  const setEnabled = useSecurityPrefsStore((s) => s.setAppLockEnabled);
  const [checking, setChecking] = useState(false);

  const onChange = async (next: boolean) => {
    setChecking(true);
    try {
      const result = await verifyOwner(i18n.t(PIN_COPY.enter), i18n.t(CHANGE_SETTING_PROMPT));
      if (result === "passed") setEnabled(next);
      else if (result === "unavailable") {
        if (next) useToastStore.getState().show(i18n.t("security.appLock.noLock"), "warning");
        else setEnabled(false);
      } else if (result === "failed") useToastStore.getState().show(i18n.t("security.verifyFailed"), "warning");
    } finally {
      setChecking(false);
    }
  };

  return (
    <ListToggleRow
      title={t("security.appLock.title")}
      icon={LockGlyph}
      tone={colors.info}
      value={enabled}
      onValueChange={onChange}
      disabled={checking}
      testID="switch-app-lock"
    />
  );
}
