import { useState } from "react";
import { Text } from "react-native";
import { Image } from "expo-image";

import { findOpenMoji, openMojiImageUrl } from "@/lib/openmoji";

interface EmojiGlyphProps {
  /** A stored `icon` value — normally a Unicode emoji. */
  emoji: string;
  size: number;
}

// Draws a stored icon as its OpenMoji artwork, giving every icon one
// consistent look instead of whatever the device's emoji font renders.
// Anything that isn't an OpenMoji emoji (an old free-text label such as "⋯"),
// or artwork that can't load, falls back to plain text.
//
// expo-image rather than RN's Image, for the cache: `memory-disk` keeps each
// PNG in RAM and on disk after its first download, so scrolling back to a row
// or reopening the app draws it with no network request — decoded natively
// (SDWebImage / Glide), off the JS thread. `recyclingKey` stops a recycled
// list cell from briefly showing the previous row's emoji.
export function EmojiGlyph({ emoji, size }: EmojiGlyphProps) {
  // Keyed by the emoji it failed for, so switching to a different icon retries.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const entry = findOpenMoji(emoji);

  if (!entry || failedFor === emoji) {
    return <Text style={{ fontSize: size * 0.8 }}>{emoji}</Text>;
  }
  return (
    <Image
      source={{ uri: openMojiImageUrl(entry.hexcode) }}
      style={{ width: size, height: size }}
      contentFit="contain"
      cachePolicy="memory-disk"
      recyclingKey={entry.hexcode}
      // A short fade-in instead of a hard pop when the artwork arrives.
      transition={120}
      onError={() => setFailedFor(emoji)}
      accessibilityLabel={entry.annotation}
    />
  );
}
