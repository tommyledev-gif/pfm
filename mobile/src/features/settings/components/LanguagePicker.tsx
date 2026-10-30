import { View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { ListRow, ListSection } from "@/components/ui/grouped-list";
import { CheckIcon } from "@/components/ui/Icon";
import { createStyles, useColors } from "@/lib/theme";
import { SUPPORTED_LANGUAGES } from "@/locales/languages";
import { useUiPrefsStore } from "@/stores/ui-prefs-store";
import { useSwitchLanguage } from "@/theme/use-switch-language";

const CHECK_SIZE = 18;

// Cài đặt người dùng → "Ngôn ngữ" (specs/mobile-language-switch US-01, D-05):
// one radio row per language, each written in its own language, so someone
// who switched by mistake still finds the way back. Applies on tap — no save
// step, no restart — through the same cross-fade as the theme tiles above.
export function LanguagePicker() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const language = useUiPrefsStore((s) => s.language);
  const switchLanguage = useSwitchLanguage();

  return (
    <ListSection
      header={t("userSettings.language.header")}
      footer={t("userSettings.language.footer")}
      testID="section-settings-language"
    >
      {SUPPORTED_LANGUAGES.map(({ code, label }) => {
        const selected = code === language;
        return (
          <ListRow
            key={code}
            title={label}
            onPress={() => switchLanguage(code)}
            chevron={false}
            // A fixed-size slot, so the title never shifts as the check moves.
            trailing={
              <View style={styles.checkSlot}>
                {/* Springs in on the row just picked, like the theme tile's tick. */}
                {selected ? (
                  <Animated.View entering={ZoomIn.springify().damping(12)}>
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
  );
}

const useStyles = createStyles(() => ({
  checkSlot: { width: CHECK_SIZE, height: CHECK_SIZE, alignItems: "center", justifyContent: "center" },
}));
