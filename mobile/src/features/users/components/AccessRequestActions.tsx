import { View } from "react-native";

import { createStyles, spacing } from "@/lib/theme";
import { ApproveRequestButton } from "@/features/users/components/ApproveRequestButton";
import { RejectRequestButton } from "@/features/users/components/RejectRequestButton";

interface AccessRequestActionsProps {
  userId: string;
  email: string;
}

// The two decisions on a waiting access request, side by side. Shown on the
// request's row in Thành viên and on the admin's notification about it.
export function AccessRequestActions({ userId, email }: AccessRequestActionsProps) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <ApproveRequestButton userId={userId} email={email} />
      <RejectRequestButton userId={userId} email={email} />
    </View>
  );
}

const useStyles = createStyles(() => ({
  row: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
}));
