import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { SparkleIcon } from "@/components/ui/Icon";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { ContinueAsList } from "@/features/accounts/components/ContinueAsList";
import { spacing, typography, createStyles } from "@/lib/theme";

export default function LoginScreen() {
  const styles = useStyles();
  const router = useRouter();

  const [prefillEmail, setPrefillEmail] = useState<string | undefined>(
    "owner@example.com",
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <SparkleIcon size={28} />
        <Text style={styles.title}>Budgest</Text>
        <Text style={styles.subtitle}>Log in to manage your money</Text>
      </View>

      <ContinueAsList onPrefill={setPrefillEmail} />

      <LoginForm
        key={prefillEmail ?? ""}
        initialEmail={prefillEmail}
        onDone={() => {
          router.replace("/(app)/(tabs)");
        }}
      />
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.bgApp,
  },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
    gap: spacing.xxl,
  },
  header: {
    alignItems: "center",
    gap: spacing.xs,
  },
  title: {
    ...typography.hero,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.label,
    color: colors.textSecondary,
  },
}));