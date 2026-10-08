import { ImageStyle, StyleProp } from "react-native";
import { Image } from "expo-image";

import { useThemeDefinition } from "@/lib/theme";

// Empty-state artwork, one light and one dark WebP per screen.
//
// Rasterised from assets/app-img/*.svg — Canva exports that are raster layers
// behind luminance masks, 1–3 MB each and far too heavy for react-native-svg —
// with each file's flat background keyed out to transparent so it sits on
// either theme's card (the same treatment as Home's onboarding art). Both
// themes of a pair share one crop, so `width / height` is the aspect ratio of
// either file.
const ILLUSTRATIONS = {
  spending: {
    light: require("../../../assets/app-img/light-empty-spending.webp"),
    dark: require("../../../assets/app-img/dark-empty-spending.webp"),
    width: 982,
    height: 510,
  },
  transactions: {
    light: require("../../../assets/app-img/light-empty-transaction.webp"),
    dark: require("../../../assets/app-img/dark-empty-transaction.webp"),
    width: 982,
    height: 502,
  },
  budgets: {
    light: require("../../../assets/app-img/light-empty-budgets.webp"),
    dark: require("../../../assets/app-img/dark-empty-budgets.webp"),
    width: 982,
    height: 474,
  },
  aiChat: {
    light: require("../../../assets/app-img/light-empty-ai-chat.webp"),
    dark: require("../../../assets/app-img/dark-empty-ai-chat.webp"),
    width: 982,
    height: 849,
  },
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

interface ThemedIllustrationProps {
  name: IllustrationName;
  /** Caps the width in dp — for near-square art that would otherwise take
   *  most of a short screen's height at full card width. */
  maxWidth?: number;
  style?: StyleProp<ImageStyle>;
}

/** Full width of its container at the art's own aspect ratio; decorative. */
export function ThemedIllustration({ name, maxWidth, style }: ThemedIllustrationProps) {
  const { isDark } = useThemeDefinition();
  const art = ILLUSTRATIONS[name];
  return (
    <Image
      source={isDark ? art.dark : art.light}
      style={[{ width: "100%", maxWidth, aspectRatio: art.width / art.height }, style]}
      contentFit="contain"
      accessible={false}
    />
  );
}
