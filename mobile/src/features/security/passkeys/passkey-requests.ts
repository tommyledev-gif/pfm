import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { LoginResult } from "@/features/auth/types";
import { PasskeyItem } from "@/features/security/passkeys/types";
import { deviceName } from "@/lib/device-identity";
import { createPasskeyCredential, getPasskeyAssertion } from "@/features/security/passkeys/native-passkey";

// Mirrors backend/internal/dto/passkey.go.
interface PasskeyOptionsResponse {
  challenge_id: string;
  /** The WebAuthn `publicKey` options, handed to the phone unchanged. */
  options: unknown;
}

/**
 * A whole passkey sign-in: the server's challenge, the phone's fingerprint/
 * face prompt, the server's check. Same answer as POST /auth/login, so the
 * caller finishes it with completeLogin like any sign-in.
 *
 * `userId` (switching to a saved account) limits it to that account's
 * passkeys; the server answers 404 PASSKEY_NOT_FOUND when it has none.
 */
export async function signInWithPasskey(userId?: string): Promise<LoginResult> {
  const begin = await apiClient.post<ApiEnvelope<PasskeyOptionsResponse>>("/auth/passkeys/login/begin", userId ? { user_id: userId } : {});
  const { challenge_id, options } = unwrap(begin.data);
  const credential = await getPasskeyAssertion(options);
  const finish = await apiClient.post<ApiEnvelope<LoginResult>>("/auth/passkeys/login/finish", { challenge_id, credential });
  return unwrap(finish.data);
}

/** Adds a passkey on this phone to the signed-in account. */
export async function registerPasskey(): Promise<PasskeyItem> {
  const begin = await apiClient.post<ApiEnvelope<PasskeyOptionsResponse>>("/users/me/passkeys/register/begin");
  const { challenge_id, options } = unwrap(begin.data);
  const credential = await createPasskeyCredential(options);
  const finish = await apiClient.post<ApiEnvelope<PasskeyItem>>("/users/me/passkeys/register/finish", {
    challenge_id,
    credential,
    name: deviceName(),
  });
  return unwrap(finish.data);
}

export async function listPasskeys(): Promise<PasskeyItem[]> {
  const res = await apiClient.get<ApiEnvelope<PasskeyItem[]>>("/users/me/passkeys");
  return unwrap(res.data);
}

export async function deletePasskey(id: string): Promise<void> {
  await apiClient.delete(`/users/me/passkeys/${id}`);
}
