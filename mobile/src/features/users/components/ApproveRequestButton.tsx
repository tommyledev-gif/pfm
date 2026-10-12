import { ActivityIndicator, Pressable, Text } from "react-native";

import { getErrorMessage } from "@/lib/axios";
import { useRequireOnline } from "@/lib/connectivity";
import { createStyles, radii, spacing, typography, useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";
import { isRequestNoLongerWaiting, REQUEST_NOT_WAITING } from "@/features/users/access-request-errors";
import { useApproveAccessRequestMutation } from "@/features/users/api/use-approve-access-request-mutation";

interface ApproveRequestButtonProps {
  userId: string;
  email: string;
}

// Approves an access request (status "requested"). Rendered by
// AccessRequestActions, next to RejectRequestButton. After approval the
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
        // Approved or rejected elsewhere; a reject leaves a 404, not a 409.
        if (isRequestNoLongerWaiting(error)) {
          showToast(REQUEST_NOT_WAITING, "info");
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
  // Placement (top margin, left alignment) is AccessRequestActions' job.
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
  },
  buttonBusy: { opacity: 0.7 },
  label: { ...typography.tiny, fontWeight: "700", color: colors.onGreen },
}));
