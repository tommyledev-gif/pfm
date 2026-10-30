import enAuth from "./en/auth.json";
import enBudgetWizard from "./en/budgetWizard.json";
import enChat from "./en/chat.json";
import enCommon from "./en/common.json";
import enErrors from "./en/errors.json";
import enHome from "./en/home.json";
import enInsights from "./en/insights.json";
import enManage from "./en/manage.json";
import enSettings from "./en/settings.json";
import enShared from "./en/shared.json";
import enTransactions from "./en/transactions.json";
import enWallets from "./en/wallets.json";
import viAuth from "./vi/auth.json";
import viBudgetWizard from "./vi/budgetWizard.json";
import viChat from "./vi/chat.json";
import viCommon from "./vi/common.json";
import viErrors from "./vi/errors.json";
import viHome from "./vi/home.json";
import viInsights from "./vi/insights.json";
import viManage from "./vi/manage.json";
import viSettings from "./vi/settings.json";
import viShared from "./vi/shared.json";
import viTransactions from "./vi/transactions.json";
import viWallets from "./vi/wallets.json";

// One file per area of the app (specs/mobile-language-switch/translations-*.md),
// each holding full top-level objects ({ "wallets": { … } }). Two areas may
// add to the same top-level object (errors.json and manage.json both write
// under "notifications"), so they are deep-merged rather than spread.
type Tree = { [key: string]: string | Tree };

function deepMerge(...trees: Tree[]): Tree {
  const out: Tree = {};
  for (const tree of trees) {
    for (const [key, value] of Object.entries(tree)) {
      const existing = out[key];
      out[key] =
        typeof value === "object" && typeof existing === "object" ? deepMerge(existing, value) : value;
    }
  }
  return out;
}

// Vietnamese is the source of truth for the key set: typed keys
// (i18next.d.ts) are read from it, and English falls back to it per key.
export type Resources = typeof viCommon &
  typeof viErrors &
  typeof viShared &
  typeof viAuth &
  typeof viHome &
  typeof viTransactions &
  typeof viChat &
  typeof viBudgetWizard &
  typeof viInsights &
  typeof viWallets &
  typeof viManage &
  typeof viSettings;

const vi = deepMerge(
  viCommon,
  viErrors,
  viShared,
  viAuth,
  viHome,
  viTransactions,
  viChat,
  viBudgetWizard,
  viInsights,
  viWallets,
  viManage,
  viSettings,
);

const en = deepMerge(
  enCommon,
  enErrors,
  enShared,
  enAuth,
  enHome,
  enTransactions,
  enChat,
  enBudgetWizard,
  enInsights,
  enWallets,
  enManage,
  enSettings,
);

export const resources = {
  vi: { translation: vi },
  en: { translation: en },
};
