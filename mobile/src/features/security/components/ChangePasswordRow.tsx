import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { ListRow } from "@/components/ui/grouped-list";
import { PasswordGlyph } from "@/components/ui/grouped-list/list-icons";
import { TranslationKey } from "@/lib/i18n";
import { useColors } from "@/lib/theme";

/** The group footer under this row on the Security screen (a key). */
export const CHANGE_PASSWORD_FOOTER = "security.changePassword.footer" satisfies TranslationKey;

/** Opens the change-password screen (specs/mobile-account-switch US-11). */
export function ChangePasswordRow() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();

  return (
    <ListRow
      title={t("nav.title.changePassword")}
      icon={PasswordGlyph}
      tone={colors.mustard}
      onPress={() => router.push("/change-password")}
      testID="row-change-password"
    />
  );
}
