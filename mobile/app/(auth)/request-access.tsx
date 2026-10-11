import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Screen } from "@/components/shared/Screen";
import { PillButton } from "@/components/ui/PillButton";
import { ChevronLeftIcon } from "@/components/ui/Icon";
import { RequestAccessForm } from "@/features/auth/components/RequestAccessForm";
import { useKeyboardHeight } from "@/lib/use-keyboard-height";
import { spacing, createStyles, useColors } from "@/lib/theme";

const COPY = {
  title: "Yêu cầu tạo tài khoản",
  sub: "Admin duyệt xong thì email kích hoạt gửi tới email của bạn.",
  sentTitle: "Đã gửi yêu cầu",
  back: "Quay lại",
  backToLogin: "Về đăng nhập",
} as const;

// Entry point: the login screen's "Gửi yêu cầu tạo tài khoản". The app is
// invite-only, so this is how someone without an invite asks for one.
export default function RequestAccessScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();
  const keyboardHeight = useKeyboardHeight();
  const [sentTo, setSentTo] = useState<string | null>(null);

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
            accessibilityLabel={COPY.back}
            testID="btn-request-access-back"
          >
            <ChevronLeftIcon size={24} color={colors.textPrimary} />
          </Pressable>
        </View>

        {sentTo ? (
          <View testID="request-access-sent">
            <Text style={styles.title} accessibilityRole="header">{COPY.sentTitle}</Text>
            <Text style={styles.sub}>{`Admin duyệt xong thì email kích hoạt gửi tới ${sentTo}.`}</Text>
            <PillButton
              label={COPY.backToLogin}
              onPress={() => router.back()}
              style={styles.button}
              textStyle={styles.buttonLabel}
              testID="btn-request-access-done"
            />
          </View>
        ) : (
          <>
            <Text style={styles.title} accessibilityRole="header">{COPY.title}</Text>
            <Text style={styles.sub}>{COPY.sub}</Text>
            <View style={styles.form}>
              <RequestAccessForm onSent={setSentTo} />
            </View>
          </>
        )}
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
  button: { height: 56, borderRadius: 16, marginTop: 32 },
  buttonLabel: { fontSize: 16 },
}));
