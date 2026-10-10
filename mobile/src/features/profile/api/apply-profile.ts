import { QueryClient } from "@tanstack/react-query";

import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { profileQueryKey } from "@/features/profile/api/use-profile-query";
import { User } from "@/features/users/types";

// What every profile write does with the User the server answers with: show it
// everywhere the profile is read, and keep this device's saved-account row
// (the account chooser and switcher) in step with it.
export function applyProfile(queryClient: QueryClient, user: User): void {
  queryClient.setQueryData(profileQueryKey(user.id), user);
  useAccountRegistryStore.getState().updateIdentity(user.id, {
    fullName: user.full_name,
    avatarUrl: user.avatar_url ?? null,
  });
}
