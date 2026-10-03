// How long a chat message must be held before its action menu opens — the
// platform's standard long-press, so the gesture is as discoverable as it is
// everywhere else on the phone.
export const MESSAGE_HOLD_MS = 500;
// The short buzz that confirms a hold registered (expo-haptics is not a
// dependency; Vibration is what react-native ships with).
export const HOLD_VIBRATION_MS = 20;
