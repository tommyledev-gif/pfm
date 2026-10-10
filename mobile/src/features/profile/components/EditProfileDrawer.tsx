import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { Drawer } from "@/components/shared/Drawer";
import { Avatar } from "@/components/ui/Avatar";
import { PillButton } from "@/components/ui/PillButton";
import { getErrorMessage } from "@/lib/axios";
import { withAlpha } from "@/lib/color";
import { useRequireOnline } from "@/lib/connectivity";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useSessionStore } from "@/stores/session-store";
import { useToastStore } from "@/stores/toast-store";
import { accountDisplayName } from "@/features/accounts/account-registry-store";
import { useRemoveAvatarMutation, useUploadAvatarMutation } from "@/features/profile/api/use-avatar-mutations";
import { useProfileQuery } from "@/features/profile/api/use-profile-query";
import { useUpdateProfileMutation } from "@/features/profile/api/use-update-profile-mutation";

// Longest name the server accepts (service.ProfileNameMaxLength).
const NAME_MAX_LENGTH = 60;
const AVATAR_SIZE = 88;

const COPY = {
  title: "Hồ sơ",
  nameLabel: "Tên",
  namePlaceholder: "Nguyễn Văn A",
  changePhoto: "Đổi ảnh",
  removePhoto: "Xóa ảnh",
  cancel: "Hủy",
  save: "Lưu",
  saved: "Đã lưu",
  photoChanged: "Đã đổi ảnh",
  photoRemoved: "Đã xóa ảnh",
  saveFailed: "Chưa lưu được tên. Thử lại.",
  photoFailed: "Chưa đổi được ảnh. Thử lại.",
  removeFailed: "Chưa xóa được ảnh. Thử lại.",
  photosDenied: "Chưa có quyền truy cập ảnh. Cấp quyền trong cài đặt của máy.",
} as const;

interface EditProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
}

// The signed-in User's own name and picture (PATCH /users/me, POST and DELETE
// /users/me/avatar). Name and picture save separately: a picture applies the
// moment it is picked, like the wallet and category icons, while the name waits
// for Lưu.
export function EditProfileDrawer({ visible, onClose }: EditProfileDrawerProps) {
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const email = useSessionStore((s) => s.email);
  const profile = useProfileQuery().data;
  const updateProfile = useUpdateProfileMutation();
  const uploadAvatar = useUploadAvatarMutation();
  const removeAvatar = useRemoveAvatarMutation();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!visible) return;
    setName(profile?.full_name ?? "");
    updateProfile.reset();
    uploadAvatar.reset();
    removeAvatar.reset();
    // Re-seed only when the sheet opens, never while the User is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const displayName = accountDisplayName({ email: email ?? "", fullName: profile?.full_name ?? null });
  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== (profile?.full_name ?? "");
  const busy = updateProfile.isPending || uploadAvatar.isPending || removeAvatar.isPending;

  const save = () => {
    updateProfile.mutate(trimmed, {
      onSuccess: () => {
        useToastStore.getState().show(COPY.saved, "info");
        onClose();
      },
    });
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      useToastStore.getState().show(COPY.photosDenied, "warning");
      return;
    }
    // Square crop: the avatar is a circle, and a cropped picture is also far
    // smaller than a full photo (the server refuses files over 2 MB).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? "image/jpeg";
    const fileName = asset.fileName ?? `avatar.${mimeType.split("/")[1] ?? "jpg"}`;
    uploadAvatar.mutate(
      { uri: asset.uri, name: fileName, mimeType },
      { onSuccess: () => useToastStore.getState().show(COPY.photoChanged, "info") },
    );
  };

  const removePhoto = () => {
    removeAvatar.mutate(undefined, {
      onSuccess: () => useToastStore.getState().show(COPY.photoRemoved, "info"),
    });
  };

  const error = updateProfile.isError
    ? getErrorMessage(updateProfile.error, COPY.saveFailed)
    : uploadAvatar.isError
      ? getErrorMessage(uploadAvatar.error, COPY.photoFailed)
      : removeAvatar.isError
        ? getErrorMessage(removeAvatar.error, COPY.removeFailed)
        : null;

  return (
    <Drawer visible={visible} onClose={onClose}>
      <Text style={styles.title}>{COPY.title}</Text>

      <View style={styles.photoBlock}>
        <Avatar name={displayName} iconUrl={profile?.avatar_url} size={AVATAR_SIZE} fallback="initial" />
        <View style={styles.photoActions}>
          <PillButton
            label={COPY.changePhoto}
            variant="outline"
            onPress={() => requireOnline(pickPhoto)}
            loading={uploadAvatar.isPending}
            disabled={busy}
            testID="btn-profile-change-photo"
          />
          {profile?.avatar_url ? (
            <Pressable
              onPress={() => requireOnline(removePhoto)}
              disabled={busy}
              accessibilityRole="button"
              testID="btn-profile-remove-photo"
            >
              <Text style={styles.removeLabel}>{COPY.removePhoto}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Text style={styles.label}>{COPY.nameLabel}</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={COPY.namePlaceholder}
        placeholderTextColor={colors.textMuted}
        maxLength={NAME_MAX_LENGTH}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => canSave && requireOnline(save)}
        style={styles.input}
        testID="input-profile-name"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <PillButton label={COPY.cancel} variant="outline" onPress={onClose} style={styles.flexButton} />
        <PillButton
          label={COPY.save}
          onPress={() => requireOnline(save)}
          loading={updateProfile.isPending}
          disabled={!canSave || busy}
          style={styles.flexButton}
          testID="btn-profile-save"
        />
      </View>
    </Drawer>
  );
}

const useStyles = createStyles((colors) => ({
  title: { ...typography.title, color: colors.textPrimary },
  photoBlock: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  photoActions: { gap: spacing.sm, alignItems: "flex-start" },
  removeLabel: { ...typography.caption, color: colors.peach, paddingHorizontal: spacing.sm },
  label: { ...typography.caption, color: colors.textSecondary },
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
