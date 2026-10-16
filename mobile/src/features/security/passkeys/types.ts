// Mirrors backend/internal/dto/passkey.go PasskeyResponse.
export interface PasskeyItem {
  id: string;
  /** The phone it was made on ("Samsung SM-S918B"). */
  name: string;
  created_at: string;
  last_used_at: string | null;
}
