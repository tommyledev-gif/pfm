import "i18next";

import type { Resources } from "./index";

// Typed keys (specs/mobile-language-switch §5.2): t("wallets.form.titel")
// is a tsc error, not a raw key on screen.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: Resources };
  }
}
