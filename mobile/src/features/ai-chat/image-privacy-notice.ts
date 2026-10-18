import AsyncStorage from "@react-native-async-storage/async-storage";

// The once-per-User-per-device privacy notice before the first photo
// (specs/ai-chat-image-capture BR-21, AC-51). Kept per User so another
// account on the same phone sees it too (S-AIIMG-73); never cleared at logout.
// A failed read counts as "not seen": the notice shows again, never the
// other way round.

const ACK_KEY_PREFIX = "image-privacy-ack:";
const ACK_VALUE = "1";

export async function hasSeenImagePrivacyNotice(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ACK_KEY_PREFIX + userId)) === ACK_VALUE;
  } catch {
    return false;
  }
}

export async function markImagePrivacyNoticeSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ACK_KEY_PREFIX + userId, ACK_VALUE);
  } catch {
    // Shown again next time; nothing else depends on it.
  }
}
