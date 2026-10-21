import { useRouter } from "expo-router";

import { ListRow } from "@/components/ui/grouped-list";
import { PasswordGlyph } from "@/components/ui/grouped-list/list-icons";
import { useColors } from "@/lib/theme";

const LABEL = "Đổi mật khẩu";
/** The group footer under this row on the Security screen. */
export const CHANGE_PASSWORD_FOOTER = "Thiết bị khác sẽ phải đăng nhập lại.";

/** Opens the change-password screen (specs/mobile-account-switch US-11). */
export function ChangePasswordRow() {
  const colors = useColors();
  const router = useRouter();

  return (
    <ListRow
      title={LABEL}
      icon={PasswordGlyph}
      tone={colors.mustard}
      onPress={() => router.push("/change-password")}
      testID="row-change-password"
    />
  );
}
