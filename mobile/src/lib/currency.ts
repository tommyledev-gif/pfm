// Shared money formatter — mirrors frontend/src/lib/currency.ts exactly, so
// mobile and web never disagree on a VND-cents-to-display conversion (see
// specs/ai-chat-assistant's own live-tested cents-conversion bug — every
// amount from the API is integer cents and must go through here, never
// `amount / 100` inline in a component).
export function formatCurrency(amountCents: number, currency: string = "VND"): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Inverse of the above — converts a form input collected in the wallet's
// display currency (e.g. a User typing "1000000" VND) into the integer cents
// the API expects. Never multiply by 100 inline in a component.
export function toCents(amountMajorUnits: number): number {
  return Math.round(amountMajorUnits * 100);
}

// Inverse of toCents — converts integer cents from the API into the major
// unit value an editable form input should display. Never divide by 100
// inline in a component.
export function toMajorUnits(amountCents: number): number {
  return amountCents / 100;
}
