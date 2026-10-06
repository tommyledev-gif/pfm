import { useRouter } from "expo-router";

import { useLatestCallback } from "@/lib/use-latest-callback";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";

/**
 * Opens the Wallets screen straight into its "new wallet" form — every
 * "you need a wallet first" prompt in the app lands here, so none of them is
 * a dead end that only explains. `create` is a nonce, so a second prompt
 * re-opens the form even though the screen is already on the stack.
 */
export function useOpenWalletCreator() {
  const router = useRouter();
  return useLatestCallback(() => router.push({ pathname: "/wallets", params: { create: String(Date.now()) } }));
}

/**
 * True only once the wallet list has loaded and is empty — never while it is
 * still loading or unavailable offline, so no prompt flashes up for an
 * account that has wallets.
 */
export function useNeedsFirstWallet(): boolean {
  const wallets = useWalletsQuery();
  return wallets.isSuccess && wallets.data.length === 0;
}
