import { create } from "zustand";

// Set after the server answered AI_IMAGE_DISABLED (specs/ai-chat-image-capture
// BR-18): the attach button stays off for the rest of this app session, so
// nobody takes a photo the server will refuse. UI state, never persisted —
// a restart asks the server again (S-AIIMG-57).
interface ImageReadingSessionState {
  off: boolean;
  markOff: () => void;
}

export const useImageReadingSessionStore = create<ImageReadingSessionState>((set) => ({
  off: false,
  markOff: () => set({ off: true }),
}));
