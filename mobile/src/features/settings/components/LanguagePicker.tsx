import { useRef } from "react";
import { View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { PRESS_SPRING } from "@/components/motion/motion-tokens";
import { Drawer } from "@/components/shared/Drawer";
import { DrawerHeader } from "@/components/shared/DrawerHeader";
import { ListRow, ListSection } from "@/components/ui/grouped-list";
import { CheckIcon } from "@/components/ui/Icon";
import { createStyles, useColors } from "@/lib/theme";
import { Language, SUPPORTED_LANGUAGES } from "@/locales/languages";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";
import { useSwitchLanguage } from "@/theme/use-switch-language";

const CHECK_SIZE = 18;

// Cài đặt người dùng → "Ngôn ngữ" (specs/mobile-language-switch US-01, D-05):
// one row naming the language in use, which opens LanguageSheet. Two parts
// because the sheet has to sit at the screen's root: inside the settings
// ScrollView, the Drawer's overlay was clipped to the scroll area.
export function LanguagePicker({ onOpen }: { onOpen: () => void }) {
  const { t } = useTranslation();
  const language = useUiPrefsStore((s) => s.language);
  const current = SUPPORTED_LANGUAGES.find((option) => option.code === language) ?? SUPPORTED_LANGUAGES[0];

  return (
    <ListSection testID="section-settings-language">
      <ListRow
        title={t("userSettings.language.header")}
        value={current.label}
        onPress={onOpen}
        testID="btn-language-picker"
      />
    </ListSection>
  );
}

interface LanguageSheetProps {
  visible: boolean;
  onClose: () => void;
}

// One radio row per language, each written in its own language, so someone
// who switched by mistake still finds the way back. Applies on tap — no save
// step, no restart: the sheet slides away, then the screen is snapshotted and
// dims under a loader until every mounted screen has re-rendered, then
// cross-fades like the theme tiles (ThemeTransitionHost).
//
// ⚠️ The switch waits for the sheet to be gone (Drawer's onExited). Started
// on the tap, it snapshotted the sheet halfway down with the dim still up,
// re-rendered the sheet in the new language beneath that picture, and the
// dissolve then swapped a half-closed sheet for an empty screen: the sheet
// shook, then flashed away.
export function LanguageSheet({ visible, onClose }: LanguageSheetProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const language = useUiPrefsStore((s) => s.language);
  const switchLanguage = useSwitchLanguage();
  // The language tapped, switched to once the sheet has slid away.
  const picked = useRef<Language | null>(null);

  const pick = (code: Language) => {
    picked.current = code;
    onClose();
  };

  const onExited = () => {
    const code = picked.current;
    picked.current = null;
    if (code) switchLanguage(code);
  };

  return (
    <Drawer visible={visible} onClose={onClose} onExited={onExited}>
      <DrawerHeader
        title={t("userSettings.language.header")}
        actions={[{ label: t("common.action.close"), variant: "secondary", onPress: onClose }]}
      />
      <ListSection onSheet footer={t("userSettings.language.footer")}>
        {SUPPORTED_LANGUAGES.map(({ code, label }) => {
          const selected = code === language;
          return (
            <ListRow
              key={code}
              title={label}
              onPress={() => pick(code)}
              chevron={false}
              // A fixed-size slot, so the title never shifts as the check moves.
              trailing={
                <View style={styles.checkSlot}>
                  {/* Springs in on the row in use, like the theme tile's tick. */}
                  {selected ? (
                    <Animated.View
                      entering={ZoomIn.springify()
                        .damping(PRESS_SPRING.damping)
                        .stiffness(PRESS_SPRING.stiffness)
                        .mass(PRESS_SPRING.mass)}
                    >
                      <CheckIcon size={CHECK_SIZE} color={colors.green} strokeWidth={3} />
                    </Animated.View>
                  ) : null}
                </View>
              }
              accessibilityRole="radio"
              selected={selected}
              accessibilityLabel={t("userSettings.language.optionA11y", { language: label })}
              testID={`btn-language-${code}`}
            />
          );
        })}
      </ListSection>
    </Drawer>
  );
}

const useStyles = createStyles(() => ({
  checkSlot: { width: CHECK_SIZE, height: CHECK_SIZE, alignItems: "center", justifyContent: "center" },
}));
