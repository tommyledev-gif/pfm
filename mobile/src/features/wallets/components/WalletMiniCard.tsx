import { View } from "react-native";

import { EmojiGlyph } from "@/components/ui/EmojiGlyph";
import { UsersIcon, WalletIcon } from "@/components/ui/Icon";
import { readableInk, withAlpha } from "@/lib/color";
import { createStyles, walletCardInk } from "@/lib/theme";
import { WalletCardArt } from "@/features/wallets/components/WalletCardArt";

const SIZES = {
  sm: { width: 52, height: 34, radius: 8, glyph: 16, badge: 16 },
  lg: { width: 84, height: 54, radius: 12, glyph: 24, badge: 22 },
} as const;

interface WalletMiniCardProps {
  accentColor: string;
  /** The wallet's emoji icon; a plain wallet glyph without one. */
  icon?: string | null;
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
export function WalletMiniCard({ accentColor, icon, size = "sm", shared = false }: WalletMiniCardProps) {
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
            {icon ? <EmojiGlyph emoji={icon} size={m.glyph} /> : <WalletIcon size={m.glyph} color={withAlpha(ink, 0.9)} />}
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
