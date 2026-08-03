import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReportTotal } from "@/features/reports/types";
import { formatCurrency } from "@/lib/currency";

interface ReportTotalsCardsProps {
  totals: ReportTotal[];
}

// One card per currency with activity in the window — a currency with zero
// matching Transactions simply has no entry (spec.md Edge Cases US-01 #4),
// never a zero-filled card.
export function ReportTotalsCards({ totals }: ReportTotalsCardsProps) {
  if (totals.length === 0) {
    return (
      <p data-testid="empty-report" className="py-8 text-center text-sm text-muted-foreground">
        No activity in this range.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {totals.map((total) => (
        <Card key={total.currency} data-testid="card-report-totals">
          <CardHeader>
            <CardTitle>{total.currency}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Income</span>
              <span>{formatCurrency(total.total_income, total.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expense</span>
              <span>{formatCurrency(total.total_expense, total.currency)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Net</span>
              <span className={total.net < 0 ? "text-destructive" : ""}>{formatCurrency(total.net, total.currency)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
