import { StyleSheet, Text } from "react-native";

import { colors, typography } from "@/lib/theme";

// Shared inline-error text — the exact { color: colors.peach, ...typography.caption }
// style that used to be duplicated as a form-local `error` style everywhere,
// now used for per-field messages too instead of only the one mutation-level
// error each form already showed.
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

const styles = StyleSheet.create({
  error: { color: colors.peach, ...typography.caption },
});
