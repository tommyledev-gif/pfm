import { StyleSheet, Text, View } from "react-native";

// Placeholder home screen — first real feature screen (wallets, once mobile
// scope resumes past this setup pass) replaces this.
export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to PFM</Text>
      <Text style={styles.subtitle}>Home — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  title: { fontSize: 28, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#666" },
});
