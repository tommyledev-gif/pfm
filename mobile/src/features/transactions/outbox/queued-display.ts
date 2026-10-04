import { FALLBACK_CURRENCY } from "@/lib/constants";
import { Category } from "@/features/categories/types";
import { OutboxDisplay, OutboxPayload } from "@/features/transactions/outbox/outbox-types";
import { Wallet } from "@/features/wallets/types";

// Names are captured when the item is queued, so the row still reads right
// after its Wallet or Category drops out of the saved data (EC-OFF-23).
export function buildQueuedDisplay(
  payload: OutboxPayload,
  wallets: Wallet[] | undefined,
  categories: Category[] | undefined,
): OutboxDisplay {
  const wallet = wallets?.find((w) => w.id === payload.wallet_id);
  const toWallet = payload.to_wallet_id ? wallets?.find((w) => w.id === payload.to_wallet_id) : undefined;
  const category = payload.category_id ? categories?.find((c) => c.id === payload.category_id) : undefined;
  return {
    wallet_name: wallet?.name ?? "",
    to_wallet_name: toWallet?.name ?? null,
    category_name: category?.name ?? null,
    category_icon: category?.icon ?? null,
    currency: wallet?.currency ?? FALLBACK_CURRENCY,
  };
}
