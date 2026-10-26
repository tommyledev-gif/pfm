import { View } from "react-native";
import { Image } from "expo-image";

import { EmojiGlyph } from "@/components/ui/EmojiGlyph";
import { UsersIcon, WalletIcon } from "@/components/ui/Icon";
import { readableInk, withAlpha } from "@/lib/color";
import { createStyles, walletCardInk } from "@/lib/theme";
import { WalletCardArt } from "@/features/wallets/components/WalletCardArt";

const SIZES = {
  sm: { width: 52, height: 34, radius: 8, glyph: 16, photo: 22, photoRadius: 6, badge: 16 },
  lg: { width: 84, height: 54, radius: 12, glyph: 24, photo: 34, photoRadius: 9, badge: 22 },
} as const;

interface WalletMiniCardProps {
  accentColor: string;
  /** The wallet's emoji icon; a plain wallet glyph without one (or a photo). */
  icon?: string | null;
  /** The wallet's uploaded photo: wins over `icon`, as on the full card. */
  iconUrl?: string | null;
  size?: keyof typeof SIZES;
  /** Adds the small people badge in the corner — a wallet with members. */
  shared?: boolean;
}

/**
 * A wallet as a small bank card: the same face the carousel paints
 * (WalletCardArt) at thumbnail size, the wallet's icon on it, and a people
 * badge when it is shared. Stands for a wallet wherever the full card would
 * not fit — the shared-wallet list, the members sheet, invitations — so it is
 * recognisably the same object as the card on Home.
 */
export function WalletMiniCard({ accentColor, icon, iconUrl, size = "sm", shared = false }: WalletMiniCardProps) {
  const styles = useStyles();
  const m = SIZES[size];
  const ink = readableInk(accentColor, walletCardInk.dark, walletCardInk.light);
  return (
    <View style={{ width: m.width, height: m.height }}>
      <View
        style={[
          styles.face,
          { width: m.width, height: m.height, borderRadius: m.radius, backgroundColor: accentColor, shadowColor: accentColor },
        ]}
      >
        <View style={[styles.clip, { borderRadius: m.radius }]}>
          <WalletCardArt accentColor={accentColor} width={m.width} height={m.height} />
          <View style={styles.glyph}>
            {iconUrl ? (
              // A small tile on the face, like the full card's icon tile: a
              // photo stretched over the whole card would hide which card it is.
              <Image
                source={{ uri: iconUrl }}
                cachePolicy="memory-disk"
                recyclingKey={iconUrl}
                style={[
                  styles.photo,
                  { width: m.photo, height: m.photo, borderRadius: m.photoRadius, borderColor: withAlpha(ink, 0.35) },
                ]}
              />
            ) : icon ? (
              <EmojiGlyph emoji={icon} size={m.glyph} />
            ) : (
              <WalletIcon size={m.glyph} color={withAlpha(ink, 0.9)} />
            )}
          </View>
        </View>
      </View>
      {shared ? (
        <View style={[styles.badge, { width: m.badge, height: m.badge, borderRadius: m.badge / 2 }]}>
          <UsersIcon size={m.badge * 0.58} color={walletCardInk.dark} strokeWidth={2.4} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // Shadow on the outer layer, clipping on the inner one: iOS draws no shadow
  // for a view that clips (same split as WalletStackCard).
  face: { shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  clip: { flex: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  glyph: { alignItems: "center", justifyContent: "center" },
  photo: { borderWidth: 1 },
  badge: {
    position: "absolute",
    right: -5,
    bottom: -5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: colors.surface,
  },
}));
