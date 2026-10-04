import { StyleProp, Text, ViewStyle, View } from "react-native";

import { OFFLINE_NO_DATA_MESSAGE } from "@/lib/constants";
import { spacing, typography, createStyles } from "@/lib/theme";

interface OfflinePlaceholderProps {
  style?: StyleProp<ViewStyle>;
}

// "Offline — nothing saved for this view" (EC-OFF-06, AC-OFF-09): shown in
// place of a skeleton or an empty state when a query has no saved data and
// is waiting for a connection (see lib/query-status.ts).
export function OfflinePlaceholder({ style }: OfflinePlaceholderProps) {
  const styles = useStyles();
  return (
    <View style={[styles.container, style]} testID="empty-offline-no-data">
      <Text style={styles.text}>{OFFLINE_NO_DATA_MESSAGE}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, alignItems: "center" },
  text: { ...typography.label, color: colors.textSecondary, textAlign: "center" },
}));
