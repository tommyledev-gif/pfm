import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, TextInput, View } from "react-native";

import { Drawer } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { errorText } from "@/lib/api-envelope";
import { withAlpha } from "@/lib/color";
import { useRequireOnline } from "@/lib/connectivity";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { USER_ROLES, UserRole } from "@/lib/constants";
import { useInviteUserMutation } from "@/features/users/api/use-invite-user-mutation";

const DEFAULT_ROLE: UserRole = "member";

interface InviteUserModalProps {
  visible: boolean;
  onClose: () => void;
}

// Household Members → invite form. Only sends the invite (POST
// /admin/users/invite) — activation happens via the emailed link, same as
// frontend/src/features/users/components/invite-user-dialog.tsx.
export function InviteUserModal({ visible, onClose }: InviteUserModalProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>(DEFAULT_ROLE);
  const inviteUser = useInviteUserMutation();
  // Stable across renders (TanStack's observer binds it once): only an open
  // resets the form, never a change of the mutation's own state.
  const resetInvite = inviteUser.reset;

  useEffect(() => {
    if (!visible) return;
    setEmail("");
    setRole(DEFAULT_ROLE);
    resetInvite();
  }, [visible, resetInvite]);

  const submit = () => {
    if (!email.trim()) return;
    inviteUser.mutate({ email: email.trim(), role }, { onSuccess: onClose });
  };

  return (
    <Drawer visible={visible} onClose={onClose}>
      <Text style={styles.title}>{t("users.invite.title")}</Text>
      <Text style={styles.description}>{t("users.invite.body")}</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="name@example.com"
        placeholderTextColor={colors.textMuted}
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />

      <Text style={styles.label}>{t("users.invite.roleLabel")}</Text>
      <View style={styles.chipRow}>
        {USER_ROLES.map((r) => (
          <Pressable key={r} onPress={() => setRole(r)} style={[styles.chip, role === r && styles.chipActive]}>
            <Text style={[styles.chipLabel, role === r && styles.chipLabelActive]}>
              {t(r === "admin" ? "common.role.admin" : "common.role.member")}
            </Text>
          </Pressable>
        ))}
      </View>

      {inviteUser.isError ? (
        <Text style={styles.error}>{errorText(inviteUser.error, "users.invite.failed")}</Text>
      ) : null}

      <View style={styles.actions}>
        <PillButton label={t("common.action.cancel")} variant="outline" onPress={onClose} style={styles.flexButton} />
        <PillButton
          label={t("users.invite.submit")}
          onPress={() => requireOnline(submit)}
          loading={inviteUser.isPending}
          disabled={!email.trim()}
          style={styles.flexButton}
        />
      </View>
    </Drawer>
  );
}

const useStyles = createStyles((colors) => ({
  title: { ...typography.title, color: colors.textPrimary },
  description: { ...typography.caption, color: colors.textSecondary },
  label: { ...typography.caption, color: colors.textSecondary },
  chipRow: { flexDirection: "row", gap: spacing.sm },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipLabel: { ...typography.caption, color: colors.textSecondary },
  chipLabelActive: { color: colors.onGreen },
  input: {
    backgroundColor: withAlpha(colors.overlayBase, 0.06),
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.textPrimary,
    ...typography.body,
  },
  error: { color: colors.peach, ...typography.caption },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  flexButton: { flex: 1 },
}));
