import { StyleSheet, Text, View } from "react-native";

// Placeholder only — the real login form + mutation
// (src/features/auth/api, src/features/auth/components) is not implemented
// in this pass. This screen exists so the (auth)/(app) route split and the
// Stack.Protected guard in app/_layout.tsx are demonstrably wired end to end.
export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>PFM</Text>
      <Text style={styles.subtitle}>Login screen — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#666" },
});
