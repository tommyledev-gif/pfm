import { EmptyIllustration } from "@/components/shared/EmptyIllustration";
import { EmptyStateCard } from "@/components/shared/EmptyState";
import { CloseIcon, PlusIcon, UsersIcon } from "@/components/ui/Icon";
import { useColors } from "@/lib/theme";

interface UsersEmptyStateProps {
  /** The list request failed — offer a retry instead of an invite. */
  failed: boolean;
  onInvite: () => void;
  onRetry: () => void;
}

/** The members list with nothing to show — either none yet, or it failed to load. */
export function UsersEmptyState({ failed, onInvite, onRetry }: UsersEmptyStateProps) {
  const colors = useColors();
  if (failed) {
    return (
      <EmptyStateCard
        testID="empty-users-error"
        illustration={
          <EmptyIllustration
            badge={<CloseIcon size={11} color={colors.onGreen} strokeWidth={2.8} />}
            badgeColor={colors.peach}
          >
            <UsersIcon size={30} color={colors.green} />
          </EmptyIllustration>
        }
        title="Không tải được danh sách thành viên"
        description="Kiểm tra kết nối mạng rồi thử lại."
        action={{ label: "Thử lại", onPress: onRetry, testID: "btn-empty-users-retry" }}
      />
    );
  }
  return (
    <EmptyStateCard
      testID="empty-users"
      illustration={
        <EmptyIllustration badge={<PlusIcon size={12} color={colors.onGreen} strokeWidth={2.6} />}>
          <UsersIcon size={30} color={colors.green} />
        </EmptyIllustration>
      }
      title="Chưa có thành viên nào"
      description="Mời người thân cùng dùng PFM — họ sẽ nhận email để kích hoạt tài khoản của riêng mình."
      action={{
        label: "Mời thành viên",
        icon: <PlusIcon size={18} color={colors.onGreen} />,
        onPress: onInvite,
        testID: "btn-empty-users-invite",
      }}
    />
  );
}
