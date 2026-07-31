// Shared money formatter — mirrors mobile/'s CurrencyFormatter. Never format
// money inline in JSX (`amount / 100`); every amount from the API is integer
// cents and must go through here.
export function formatCurrency(amountCents: number, currency: string = "VND"): string {
  const amount = amountCents / 100;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
