import { useTranslation } from "react-i18next";

import { useSessionStore } from "@/stores/session-store";
import { accountDisplayName } from "@/features/accounts/account-registry-store";
import { useProfileQuery } from "@/features/profile/api/use-profile-query";

export interface ProfileIdentity {
  name: string;
  avatarUrl: string | null;
}

// The name and picture that stand for the signed-in User: Settings' header and
// Home's top bar show the same pair. The name is the one the User set; the
// email's local part is only the fallback until one is set, or while offline
// with no saved copy of the profile.
export function useProfileIdentity(): ProfileIdentity {
  const { t } = useTranslation();
  const email = useSessionStore((s) => s.email);
  const profile = useProfileQuery().data;
  const fullName = profile?.full_name ?? null;
  const name = email ? accountDisplayName({ email, fullName }) : (fullName ?? t("profile.fallbackName"));
  return { name, avatarUrl: profile?.avatar_url ?? null };
}
