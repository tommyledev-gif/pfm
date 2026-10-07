import { ScrollView } from "react-native";

import { EmptyIllustration } from "@/components/shared/EmptyIllustration";
import { EmptyStateCard } from "@/components/shared/EmptyState";
import { PlusIcon, WalletIcon } from "@/components/ui/Icon";
import { spacing, createStyles, useColors } from "@/lib/theme";

// Clears the floating bottom nav — same clearance the screen's list uses.
const BOTTOM_NAV_CLEARANCE = 140;

/**
 * The Wallets screen with no wallet at all. Replaces both views — a carousel
 * or a grouped list of nothing would only be an empty frame with a hint.
 */
export function WalletsEmptyState({ onCreate }: { onCreate: () => void }) {
  const colors = useColors();
  const styles = useStyles();
  return (
    <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <EmptyStateCard
        testID="empty-wallets"
        illustration={
          <EmptyIllustration badge={<PlusIcon size={12} color={colors.onGreen} strokeWidth={2.6} />}>
            <WalletIcon size={30} color={colors.green} />
          </EmptyIllustration>
        }
        title="Chưa có ví nào"
        description="Tiền mặt, tài khoản ngân hàng hay ví điện tử — mỗi nguồn tiền là một ví, và mọi giao dịch đều được ghi vào một ví."
        action={{
          label: "Tạo ví đầu tiên",
          icon: <PlusIcon size={18} color={colors.onGreen} />,
          onPress: onCreate,
          testID: "btn-empty-wallets-create",
        }}
      />
    </ScrollView>
  );
}

const useStyles = createStyles(() => ({
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: BOTTOM_NAV_CLEARANCE },
}));
