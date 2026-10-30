import { PIN_LENGTH } from "@/lib/constants";
import { i18n, TranslationKey } from "@/lib/i18n";

// specs/mobile-app-pin §UI copy. Keys, passed to t() where shown (create
// takes {{length}}: PIN_LENGTH); the functions below read theirs when called.
export const PIN_COPY = {
  section: "security.pin.section",
  footer: "security.pin.footer",
  setRow: "security.pin.setRow",
  changeRow: "security.pin.changeRow",
  offRow: "security.pin.offRow",

  enter: "security.pin.enter",
  create: "security.pin.create",
  repeat: "security.pin.repeat",
  current: "security.pin.current",
  forSwitch: "security.pin.forSwitch",

  mismatch: "security.pin.mismatch",
  checkFailed: "security.pin.checkFailed",
  saveFailed: "security.pin.saveFailed",
  biometricFailed: "security.biometricFailed",

  close: "common.action.close",
  forgot: "security.pin.forgot",
  forgotMessage: "security.pin.forgotMessage",
  forgotConfirm: "security.pin.forgotConfirm",
  forgotKeep: "common.action.keep",

  set: "security.pin.set",
  changed: "security.pin.changed",
  off: "security.pin.off",
  offWithLock: "security.pin.offWithLock",
  wipedWrong: "security.pin.wipedWrong",
  wipedForgot: "security.pin.wipedForgot",

  deleteDigit: "security.pin.deleteDigitA11y",
} as const satisfies Record<string, TranslationKey>;

export function wrongPin(triesLeft: number): string {
  return i18n.t("security.pin.wrong", { count: triesLeft });
}

export function digitKey(digit: string): string {
  return i18n.t("security.pin.digitKeyA11y", { digit });
}

export function entered(count: number): string {
  return i18n.t("security.pin.enteredA11y", { count, length: PIN_LENGTH });
}
