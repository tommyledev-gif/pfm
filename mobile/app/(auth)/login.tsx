import { Text, View } from "react-native";
import { SparkleIcon } from "@/components/ui/Icon";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { spacing, typography, createStyles } from "@/lib/theme";

export default function LoginScreen() {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SparkleIcon size={28} />
        <Text style={styles.title}>Budgest</Text>
        <Text style={styles.subtitle}>Log in to manage your money</Text>
      </View>
      <LoginForm />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
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
}));
