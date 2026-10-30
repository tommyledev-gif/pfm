import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Screen } from "@/components/shared/Screen";
import { ChevronLeftIcon } from "@/components/ui/Icon";
import { useAccessRequestStore } from "@/features/auth/access-request-store";
import { RequestAccessForm } from "@/features/auth/components/RequestAccessForm";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { spacing, createStyles, useColors } from "@/lib/theme";
import { useToastStore } from "@/stores/toast-store";

// Entry point: the login screen's "Gửi yêu cầu tạo tài khoản". The app is
// invite-only, so this is how someone without an invite asks for one.
//
// Once sent it goes straight back to login, where the request waits under
// "Tài khoản đã lưu" with its sign-in held until an admin approves it.
export default function RequestAccessScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const keyboardHeight = useKeyboardHeight();

  const onSent = (email: string) => {
    useAccessRequestStore.getState().add(email);
    useToastStore.getState().show(t("auth.requestAccess.sent"), "info");
    if (router.canGoBack()) router.back();
    else router.replace("/login");
  };

  return (
    <Screen>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + keyboardHeight }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.back}
            accessibilityRole="button"
            accessibilityLabel={t("common.action.back")}
            testID="btn-request-access-back"
          >
            <ChevronLeftIcon size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        <Text style={styles.title} accessibilityRole="header">{t("auth.requestAccess.title")}</Text>
        <Text style={styles.sub}>{t("auth.requestAccess.sub")}</Text>
        <View style={styles.form}>
          <RequestAccessForm onSent={onSent} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { flexGrow: 1, paddingHorizontal: spacing.xxl, paddingTop: spacing.md },
  header: { minHeight: 44, flexDirection: "row", alignItems: "center" },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: "center", justifyContent: "center" },
  title: { marginTop: 32, fontSize: 30, lineHeight: 38, fontWeight: "700", letterSpacing: -0.3, color: colors.textPrimary },
  sub: { marginTop: spacing.sm, fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  form: { marginTop: 32 },
}));
