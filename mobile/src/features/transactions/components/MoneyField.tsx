import { useEffect, useState } from "react";

import { AmountInput } from "@/components/ui/AmountInput";
import { toMajorUnits } from "@/lib/currency";
import { parseMajorToCents } from "@/features/transactions/items/line-math";

interface MoneyFieldProps {
  cents: number | null;
  currency: string;
  onChange: (cents: number | null) => void;
  placeholder: string;
  testID?: string;
}

// AmountInput holding cents for the caller. Keeps its own text so a partial
// entry ("12.") survives, and re-syncs only when the cents change from
// outside (the quantity × unit price pre-fill).
export function MoneyField({ cents, currency, onChange, placeholder, testID }: MoneyFieldProps) {
  const [text, setText] = useState(cents === null ? "" : String(toMajorUnits(cents)));

  useEffect(() => {
    if (parseMajorToCents(text, currency) === cents) return;
    setText(cents === null ? "" : String(toMajorUnits(cents)));
    // Only an outside change of `cents` should rewrite the text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents, currency]);

  return (
    <AmountInput
      testID={testID}
      value={text}
      placeholder={placeholder}
      onChangeText={(next) => {
        setText(next);
        onChange(parseMajorToCents(next, currency));
      }}
    />
  );
}
