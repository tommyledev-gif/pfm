"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WALLET_CURRENCIES, type WalletCurrency } from "@/lib/constants";

export interface LimitRowValue {
  currency: WalletCurrency;
  amount: string; // major units (e.g. "2000000" for VND) — converted via toCents() at submit time
}

interface CurrencyLimitRowInputProps {
  value: LimitRowValue;
  usedCurrencies: WalletCurrency[]; // currencies already picked by OTHER rows — excluded here (a Budget has at most one entry per currency)
  onChange: (value: LimitRowValue) => void;
  onRemove: () => void;
  canRemove: boolean;
  disabled?: boolean;
}

// One repeatable (currency, amount) row — a Budget's `limits` is a set of
// these, never duplicated per currency (spec.md Business invariants).
export function CurrencyLimitRowInput({
  value,
  usedCurrencies,
  onChange,
  onRemove,
  canRemove,
  disabled,
}: CurrencyLimitRowInputProps) {
  return (
    <div className="flex items-end gap-2">
      <Select value={value.currency} onValueChange={(currency) => onChange({ ...value, currency: currency as WalletCurrency })}>
        <SelectTrigger data-testid="select-limit-currency" className="w-24" disabled={disabled}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WALLET_CURRENCIES.map((currency) => (
            <SelectItem key={currency} value={currency} disabled={currency !== value.currency && usedCurrencies.includes(currency)}>
              {currency}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        data-testid="input-limit-amount"
        type="number"
        min={1}
        step="any"
        required
        placeholder="Amount"
        value={value.amount}
        onChange={(e) => onChange({ ...value, amount: e.target.value })}
        disabled={disabled}
        className="flex-1"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="btn-remove-limit-row"
        onClick={onRemove}
        disabled={disabled || !canRemove}
      >
        Remove
      </Button>
    </div>
  );
}
