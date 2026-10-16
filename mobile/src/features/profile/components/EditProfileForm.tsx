import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { Avatar } from "@/components/ui/Avatar";
import { LockIcon } from "@/components/ui/Icon";
import { UploadButton } from "@/components/ui/UploadButton";
import { InlineActionField } from "@/components/shared/InlineActionField";
import { getErrorMessage } from "@/lib/axios";
import { useRequireOnline } from "@/lib/connectivity";
import { withAlpha } from "@/lib/color";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useSessionStore } from "@/stores/session-store";
import { useToastStore } from "@/stores/toast-store";
import { accountDisplayName } from "@/features/accounts/account-registry-store";
import { useRemoveAvatarMutation, useUploadAvatarMutation } from "@/features/profile/api/use-avatar-mutations";
import { useProfileQuery } from "@/features/profile/api/use-profile-query";
import { useUpdateProfileMutation } from "@/features/profile/api/use-update-profile-mutation";
import { UsernameClaimField } from "@/features/profile/components/UsernameClaimField";

// Longest name the server accepts (service.ProfileNameMaxLength).
const NAME_MAX_LENGTH = 60;
const AVATAR_SIZE = 88;

const COPY = {
  // The display name; the tên đăng nhập below is a different thing.
  nameLabel: "Tên hiển thị",
  usernameLabel: "Tên đăng nhập",
  usernameHint: "Đặt một lần lúc kích hoạt, không đổi được.",
  namePlaceholder: "Nguyễn Văn A",
  changePhoto: "Đổi ảnh",
  // The bar's own label; next to "Đổi ảnh" it can only mean the photo.
  remove: "Xóa",
  removePhoto: "Xóa ảnh",
  save: "Lưu",
  saved: "Đã lưu",
  photoChanged: "Đã đổi ảnh",
  photoRemoved: "Đã xóa ảnh",
  saveFailed: "Chưa lưu được tên. Thử lại.",
  photoFailed: "Chưa đổi được ảnh. Thử lại.",
  removeFailed: "Chưa xóa được ảnh. Thử lại.",
  photosDenied: "Chưa có quyền truy cập ảnh. Cấp quyền trong cài đặt của máy.",
} as const;

interface EditProfileFormProps {
  /** Called once the name has been saved — the screen leaves. */
  onSaved: () => void;
}

// The signed-in User's own name and picture (PATCH /users/me, POST and DELETE
// /users/me/avatar). Name and picture save separately: a picture applies the
// moment it is picked, like the wallet and category icons, while the name waits
// for Lưu. Hosted by app/(app)/edit-profile.tsx.
export function EditProfileForm({ onSaved }: EditProfileFormProps) {
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const email = useSessionStore((s) => s.email);
  const profile = useProfileQuery().data;
  const updateProfile = useUpdateProfileMutation();
  const uploadAvatar = useUploadAvatarMutation();
  const removeAvatar = useRemoveAvatarMutation();
  const [name, setName] = useState(profile?.full_name ?? "");
  const edited = useRef(false);

  // The profile may still be loading when the screen opens: fill the field
  // once it arrives, but never over what the User has already typed.
  useEffect(() => {
    if (!edited.current) setName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  const changeName = (text: string) => {
    edited.current = true;
    setName(text);
  };

  const displayName = accountDisplayName({ email: email ?? "", fullName: profile?.full_name ?? null });
  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== (profile?.full_name ?? "");
  const busy = updateProfile.isPending || uploadAvatar.isPending || removeAvatar.isPending;

  const save = () => {
    updateProfile.mutate(trimmed, {
      onSuccess: () => {
        useToastStore.getState().show(COPY.saved, "info");
        onSaved();
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
    // No toast: UploadButton ends its run on "Đã đổi ảnh" itself.
    uploadAvatar.mutate({ uri: asset.uri, name: fileName, mimeType });
  };

  const removePhoto = () => {
    removeAvatar.mutate(undefined, {
      onSuccess: () => useToastStore.getState().show(COPY.photoRemoved, "info"),
    });
  };

  // Under the field it belongs to: the name's under the name, the photo's
  // under the form.
  const nameError = updateProfile.isError ? getErrorMessage(updateProfile.error, COPY.saveFailed) : null;
  const photoError = uploadAvatar.isError
    ? getErrorMessage(uploadAvatar.error, COPY.photoFailed)
    : removeAvatar.isError
      ? getErrorMessage(removeAvatar.error, COPY.removeFailed)
      : null;

  return (
    <View style={styles.form}>
      <View style={styles.photoBlock}>
        <Avatar name={displayName} iconUrl={profile?.avatar_url} size={AVATAR_SIZE} fallback="initial" />
        {/* "Đổi ảnh" | "Xóa" in one bar; "Xóa" only once there is a picture. */}
        <View style={styles.photoActions}>
          <UploadButton
            status={uploadAvatar.status}
            label={COPY.changePhoto}
            doneLabel={COPY.photoChanged}
            onPress={() => requireOnline(pickPhoto)}
            disabled={updateProfile.isPending || removeAvatar.isPending}
            testID="btn-profile-change-photo"
            remove={
              profile?.avatar_url
                ? {
                    label: COPY.remove,
                    accessibilityLabel: COPY.removePhoto,
                    onPress: () => requireOnline(removePhoto),
                    disabled: busy,
                    testID: "btn-profile-remove-photo",
                  }
                : undefined
            }
          />
        </View>
      </View>

      {/* Read-only: chosen once on the activation page (backend mig 030).
          Accounts activated before it existed pick theirs here, once. */}
      {profile?.username ? (
        <View style={styles.usernameBlock} testID="text-profile-username">
          <Text style={styles.label}>{COPY.usernameLabel}</Text>
          {/* Same box as the field below, locked: it reads as a value, not a typo. */}
          <View style={styles.lockedBox}>
            <Text style={styles.usernameValue} selectable numberOfLines={1}>
              {profile.username}
            </Text>
            <LockIcon size={16} color={colors.textMuted} />
          </View>
          <Text style={styles.hint}>{COPY.usernameHint}</Text>
        </View>
      ) : profile ? (
        <UsernameClaimField />
      ) : null}

      {/* Name and its Lưu on one row: the button sits inside the field. */}
      <InlineActionField
        label={COPY.nameLabel}
        value={name}
        onChangeText={changeName}
        placeholder={COPY.namePlaceholder}
        maxLength={NAME_MAX_LENGTH}
        autoCapitalize="words"
        autoCorrect={false}
        actionLabel={COPY.save}
        onAction={() => requireOnline(save)}
        actionEnabled={canSave && !busy}
        loading={updateProfile.isPending}
        error={nameError}
        testID="input-profile-name"
        actionTestID="btn-profile-save"
      />

      {photoError ? <Text style={styles.error}>{photoError}</Text> : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  form: { gap: spacing.md },
  photoBlock: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  photoActions: { flexShrink: 1, alignItems: "flex-start" },
  label: { ...typography.caption, color: colors.textSecondary },
  usernameBlock: { gap: spacing.xs },
  lockedBox: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.surfaceBorder,
    backgroundColor: withAlpha(colors.overlayBase, 0.03),
  },
  usernameValue: { flex: 1, ...typography.body, color: colors.textSecondary },
  hint: { ...typography.tiny, color: colors.textMuted },
  error: { color: colors.peach, ...typography.caption },
}));
