import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { Avatar } from "@/components/ui/Avatar";
import { ListCell, ListSection } from "@/components/ui/grouped-list";
import { LockGlyph } from "@/components/ui/grouped-list/list-icons";
import { LIST_ROW_MIN_HEIGHT } from "@/components/ui/grouped-list/list-metrics";
import { UploadButton } from "@/components/ui/UploadButton";
import { InlineActionField } from "@/components/shared/InlineActionField";
import { errorText } from "@/lib/api-envelope";
import { copyOf } from "@/lib/i18n";
import { useRequireOnline } from "@/lib/connectivity";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
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

const COPY = copyOf({
  // The display name; the tên đăng nhập below is a different thing.
  nameLabel: "profile.edit.nameLabel",
  usernameLabel: "common.field.username",
  usernameHint: "profile.edit.usernameHint",
  namePlaceholder: "profile.edit.namePlaceholder",
  changePhoto: "profile.edit.changePhoto",
  // The upload card's trash button is icon-only: this names it for screen readers.
  removePhoto: "profile.edit.removePhotoA11y",
  save: "common.action.save",
  saved: "profile.edit.saved",
  photoChanged: "profile.edit.photoChanged",
  photoRemoved: "profile.edit.photoRemoved",
  saveFailed: "profile.edit.saveFailed",
  photoFailed: "profile.edit.photoFailed",
  removeFailed: "profile.edit.removeFailed",
  photosDenied: "profile.edit.photosDenied",
});

interface EditProfileFormProps {
  /** Called once the name has been saved — the screen leaves. */
  onSaved: () => void;
}

// The signed-in User's own name and picture (PATCH /users/me, POST and DELETE
// /users/me/avatar). Name and picture save separately: a picture applies the
// moment it is picked, like the wallet and category icons, while the name waits
// for Lưu. Hosted by app/(app)/edit-profile.tsx.
export function EditProfileForm({ onSaved }: EditProfileFormProps) {
  useTranslation(); // COPY reads the current language: re-render on a switch
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
  // under the photo.
  const nameError = updateProfile.isError ? errorText(updateProfile.error, "profile.edit.saveFailed") : null;
  const photoError = uploadAvatar.isError
    ? errorText(uploadAvatar.error, "profile.edit.photoFailed")
    : removeAvatar.isError
      ? errorText(removeAvatar.error, "profile.edit.removeFailed")
      : null;

  return (
    <View style={styles.form}>
      {/* The picture centred on top, its "Đổi ảnh" upload card under it, the
          way a profile screen opens on iOS. The card's trash button shows
          only once there is a picture to remove. */}
      <View style={styles.photoBlock}>
        <Avatar name={displayName} iconUrl={profile?.avatar_url} size={AVATAR_SIZE} fallback="initial" />
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
                  accessibilityLabel: COPY.removePhoto,
                  onPress: () => requireOnline(removePhoto),
                  disabled: busy,
                  testID: "btn-profile-remove-photo",
                }
              : undefined
          }
        />
        {photoError ? <Text style={styles.error}>{photoError}</Text> : null}
      </View>

      {/* Read-only: chosen once on the activation page (backend mig 030).
          Accounts activated before it existed pick theirs here, once. A row
          of a group with a lock, so it reads as a value, not a field. */}
      {profile?.username ? (
        <ListSection footer={COPY.usernameHint}>
          <ListCell style={styles.usernameRow} testID="text-profile-username">
            <Text style={styles.usernameLabel}>{COPY.usernameLabel}</Text>
            <Text style={styles.usernameValue} selectable numberOfLines={1}>
              {profile.username}
            </Text>
            <LockGlyph size={16} weight="fill" color={colors.textMuted} />
          </ListCell>
        </ListSection>
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
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  form: { gap: spacing.xxl },
  photoBlock: { alignItems: "center", gap: spacing.md },
  usernameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: LIST_ROW_MIN_HEIGHT },
  usernameLabel: { ...typography.body, fontWeight: "500", color: colors.textPrimary },
  usernameValue: { flex: 1, textAlign: "right", ...typography.body, fontWeight: "400", color: colors.textSecondary },
  error: { ...typography.caption, color: colors.peach, textAlign: "center" },
}));
