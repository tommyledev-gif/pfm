import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from "@/lib/constants";

/** UTF-8 length. bcrypt's cap counts bytes, and a Vietnamese letter takes 2-3. */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}

export type PasswordLengthProblem = "short" | "long";

/** The server's rule for a new password (backend common/password.go). */
export function passwordLengthProblem(password: string): PasswordLengthProblem | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "short";
  if (utf8ByteLength(password) > MAX_PASSWORD_BYTES) return "long";
  return null;
}
