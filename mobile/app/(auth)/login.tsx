import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SparkleIcon } from "@/components/ui/Icon";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { colors, spacing, typography } from "@/lib/theme";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <SparkleIcon size={28} />
        <Text style={styles.title}>PFM</Text>
        <Text style={styles.subtitle}>Log in to manage your money</Text>
      </View>
      <LoginForm />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgApp,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    gap: spacing.xxl,
  },
  header: { alignItems: "center", gap: spacing.xs },
  title: { ...typography.hero, color: colors.textPrimary },
  subtitle: { ...typography.label, color: colors.textSecondary },
});
