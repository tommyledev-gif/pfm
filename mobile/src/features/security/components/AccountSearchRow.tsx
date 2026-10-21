import { ListInlineButton, ListRow } from "@/components/ui/grouped-list";
import { User } from "@/features/users/types";

interface AccountSearchRowProps {
  user: User;
  deleting: boolean;
  onDelete: (user: User) => void;
}

/** One search result in the account deletion tool: who it is, and [Xóa]. */
export function AccountSearchRow({ user, deleting, onDelete }: AccountSearchRowProps) {
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
          label="Xóa"
          tone="destructive"
          onPress={() => onDelete(user)}
          loading={deleting}
          accessibilityLabel={`Xóa tài khoản ${user.email}`}
          testID={`btn-delete-account-${user.id}`}
        />
      }
      testID={`row-account-${user.id}`}
    />
  );
}
