import { ActivityIndicator, Pressable, Text } from "react-native";

import { getErrorCode, getErrorMessage } from "@/lib/axios";
import { useRequireOnline } from "@/lib/connectivity";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";
import { useApproveAccessRequestMutation } from "@/features/users/api/use-approve-access-request-mutation";

interface ApproveRequestButtonProps {
  userId: string;
  email: string;
}

// Approves an access request (status "requested"). Shown on the request's row
// in Thành viên and on the admin's notification about it. After approval the
// requester gets the activation email; the row then reads "Chờ kích hoạt".
export function ApproveRequestButton({ userId, email }: ApproveRequestButtonProps) {
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const approve = useApproveAccessRequestMutation();
  const showToast = useToastStore((s) => s.show);

  const onPress = () => {
    approve.mutate(userId, {
      onSuccess: () => showToast(`Đã duyệt. Email kích hoạt đã gửi tới ${email}.`, "info"),
      onError: (error) => {
        if (getErrorCode(error) === "ACCESS_REQUEST_HANDLED") {
          showToast("Yêu cầu này đã được duyệt.", "info");
          return;
        }
        showToast(getErrorMessage(error, "Chưa duyệt được. Thử lại."), "error");
      },
    });
  };

  return (
    <Pressable
      style={[styles.button, approve.isPending && styles.buttonBusy]}
      onPress={() => requireOnline(onPress)}
      disabled={approve.isPending}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`Duyệt yêu cầu của ${email}`}
      accessibilityState={{ disabled: approve.isPending, busy: approve.isPending }}
      testID={`btn-approve-request-${userId}`}
    >
      {approve.isPending ? <ActivityIndicator size="small" color={colors.onGreen} /> : null}
      <Text style={styles.label}>Duyệt yêu cầu</Text>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  button: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
  },
  buttonBusy: { opacity: 0.7 },
  label: { ...typography.tiny, fontWeight: "700", color: colors.onGreen },
}));
