import { ListInlineButton, ListRow } from "@/components/ui/grouped-list";
import { useTranslation } from "react-i18next";
import { User } from "@/features/users/types";

interface AccountSearchRowProps {
  user: User;
  deleting: boolean;
  onDelete: (user: User) => void;
}

/** One search result in the account deletion tool: who it is, and [Xóa]. */
export function AccountSearchRow({ user, deleting, onDelete }: AccountSearchRowProps) {
  const { t } = useTranslation();
  const name = user.full_name ?? user.username ?? user.email;
  const detail = user.username ? `${user.email} · ${user.username}` : user.email;

  return (
    <ListRow
      title={name}
      titleLines={1}
      subtitle={detail}
      subtitleLines={1}
      subtitleEllipsizeMode="middle"
      trailing={
        <ListInlineButton
          label={t("common.action.delete")}
          tone="destructive"
          onPress={() => onDelete(user)}
          loading={deleting}
          accessibilityLabel={t("security.deleteAccounts.rowA11y", { email: user.email })}
          testID={`btn-delete-account-${user.id}`}
        />
      }
      testID={`row-account-${user.id}`}
    />
  );
}
