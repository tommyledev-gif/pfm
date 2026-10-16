import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { deletePasskey, listPasskeys, registerPasskey } from "@/features/security/passkeys/passkey-requests";

const PASSKEYS_KEY = ["passkeys"] as const;

/** The signed-in account's passkeys, newest first (Security screen). */
export function usePasskeysQuery() {
  return useQuery({ queryKey: PASSKEYS_KEY, queryFn: listPasskeys });
}

/** Adds a passkey on this phone: server challenge, fingerprint prompt, server check. */
export function useRegisterPasskeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerPasskey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY }),
  });
}

export function useDeletePasskeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePasskey,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PASSKEYS_KEY }),
  });
}
