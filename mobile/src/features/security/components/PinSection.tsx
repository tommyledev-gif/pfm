import { useState } from "react";

import { ListRow, ListSection } from "@/components/ui/grouped-list";
import { PinGlyph } from "@/components/ui/grouped-list/list-icons";
import { i18n } from "@/lib/i18n";
import { useColors } from "@/lib/theme";
import { useSecurityPrefsStore } from "@/stores/security-prefs-store";
import { useToastStore } from "@/stores/toast-store";
import { CHANGE_SETTING_PROMPT, confirmOwner, phoneHasLock } from "@/features/security/identity-check";
import { PIN_COPY } from "@/features/security/pin/pin-copy";
import { requestPin } from "@/features/security/pin/pin-prompt-store";
import { usePinStore } from "@/features/security/pin/pin-store";


function toast(message: string, variant: "success" | "warning" = "success"): void {
  useToastStore.getState().show(message, variant);
}

/**
 * The app PIN on the Security screen (specs/mobile-app-pin US-01). Setting
 * one asks the phone's own check first when the phone has a lock (BR-03);
 * changing or turning it off asks for the current PIN, never a fingerprint,
 * so a PIN cannot be replaced by someone who only has the phone's lock.
 */
export function PinSection() {
  const colors = useColors();
  const hasPin = usePinStore((s) => s.hasPin);
  const [working, setWorking] = useState(false);

  const run = async (action: () => Promise<void>) => {
    if (working) return;
    setWorking(true);
    try {
      await action();
    } finally {
      setWorking(false);
    }
  };

  const setPin = () =>
    run(async () => {
      const check = await confirmOwner(CHANGE_SETTING_PROMPT);
      if (check === "cancelled") return;
      if (check === "failed") return toast(i18n.t("security.verifyFailed"), "warning");
      if ((await requestPin({ kind: "create" })) === "passed") toast(PIN_COPY.set);
    });

  const changePin = () =>
    run(async () => {
      if ((await requestPin({ kind: "change" })) === "passed") toast(PIN_COPY.changed);
    });

  // BR-08: with no screen lock, nothing could open the app lock any more.
  const turnOff = () =>
    run(async () => {
      if ((await requestPin({ kind: "verify", title: PIN_COPY.current })) !== "passed") return;
      await usePinStore.getState().clearPin();
      const prefs = useSecurityPrefsStore.getState();
      if (prefs.appLockEnabled && !(await phoneHasLock())) {
        prefs.setAppLockEnabled(false);
        return toast(PIN_COPY.offWithLock);
      }
      toast(PIN_COPY.off);
    });

  return (
    <ListSection header={PIN_COPY.section} footer={PIN_COPY.footer}>
      {/* An array, not a fragment: ListSection counts each row for its hairline. */}
      {hasPin ? (
        [
          <ListRow
            key="change"
            title={PIN_COPY.changeRow}
            icon={PinGlyph}
            tone={colors.lavender}
            onPress={() => void changePin()}
            disabled={working}
            chevron
            testID="row-pin-change"
          />,
          <ListRow
            key="off"
            title={PIN_COPY.offRow}
            variant="destructive"
            onPress={() => void turnOff()}
            disabled={working}
            testID="row-pin-off"
          />,
        ]
      ) : (
        <ListRow
          title={PIN_COPY.setRow}
          icon={PinGlyph}
          tone={colors.lavender}
          onPress={() => void setPin()}
          disabled={working}
          chevron
          testID="row-pin-set"
        />
      )}
    </ListSection>
  );
}
