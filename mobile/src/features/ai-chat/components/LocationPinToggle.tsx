import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useHintTooltip } from "@/components/shared/use-hint-tooltip";
import { MapPinIcon } from "@/components/ui/Icon";
import { withAlpha } from "@/lib/color";
import { LOCATION_TAB_BUTTON } from "@/features/ai-chat/components/chat-composer-metrics";
import { radii, createStyles, useColors } from "@/lib/theme";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";

const ICON_SIZE = 18;
const SLASH_LENGTH = 20;

/**
 * "Ghim vị trí khi tạo giao dịch" (Cài đặt người dùng) from the recording
 * pane: lit while what is recorded here gets the device's position
 * (proposal-auto-pin.ts), struck through while it does not. One tap flips the
 * same setting; a hold says what the tap does.
 *
 * A round button with no ground of its own: ChatInputBar seats it in a tab on
 * the input bar's top edge (its `floating` slot), which carries the surface
 * and the ring, so it reads as part of the bar. Inside the field it took room
 * from the text being typed.
 */
export function LocationPinToggle() {
  const colors = useColors();
  const styles = useStyles();
  const { t } = useTranslation();
  const on = useUiPrefsStore((s) => s.pinLocationByDefault);
  const setOn = useUiPrefsStore((s) => s.setPinLocationByDefault);
  const hint = useHintTooltip(on ? t("chat.pinToggle.hint.turnOff") : t("chat.pinToggle.hint.turnOn"));

  return (
    <Pressable
      testID="btn-chat-pin-location"
      accessibilityRole="switch"
      accessibilityLabel={t("chat.pinToggle.a11y")}
      accessibilityState={{ checked: on }}
      onPress={() => setOn(!on)}
      {...hint}
      hitSlop={4}
      style={styles.button}
    >
      {/* ⚠️ Never flattened. Off, the well has nothing to draw, so Fabric
          dropped its native view; turned on again it came back as a new view
          that lost the round corners, a square fill. */}
      <View
        collapsable={false}
        style={[styles.well, { backgroundColor: on ? withAlpha(colors.green, 0.14) : "transparent" }]}
      >
        <MapPinIcon size={ICON_SIZE} color={on ? colors.green : colors.textMuted} />
        {on ? null : <View style={[styles.slash, { backgroundColor: colors.textMuted }]} />}
      </View>
    </Pressable>
  );
}

const useStyles = createStyles(() => ({
  button: {
    width: LOCATION_TAB_BUTTON,
    height: LOCATION_TAB_BUTTON,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  well: { width: 28, height: 28, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  slash: { position: "absolute", width: SLASH_LENGTH, height: 1.5, borderRadius: 1, transform: [{ rotate: "-45deg" }] },
}));
