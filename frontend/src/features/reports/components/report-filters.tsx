"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import type { ReportFilters } from "@/features/reports/types";
import { TRANSACTION_TYPES } from "@/lib/constants";

interface ReportFiltersBarProps {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
}

const ALL_VALUE = "all";

// Drives GET /reports/summary's query params — mirrors transaction-filters.tsx
// minus pagination (this endpoint has no cursor, spec.md Edge Cases US-01 #6).
export function ReportFiltersBar({ filters, onChange }: ReportFiltersBarProps) {
  const { data: wallets } = useWalletsQuery();
  const { data: categories } = useCategoriesQuery(filters.type);

  return (
    <div className="grid grid-cols-2 gap-4 pb-4 sm:grid-cols-3 lg:grid-cols-5">
      <div className="space-y-2">
        <Label htmlFor="filter-report-wallet">Wallet</Label>
        <Select
          value={filters.walletId ?? ALL_VALUE}
          onValueChange={(value) => onChange({ ...filters, walletId: value === ALL_VALUE ? undefined : value })}
        >
          <SelectTrigger id="filter-report-wallet" data-testid="filter-report-wallet">
            <SelectValue placeholder="All wallets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All wallets</SelectItem>
            {wallets?.data.map((wallet) => (
              <SelectItem key={wallet.id} value={wallet.id}>
                {wallet.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-report-category">Category</Label>
        <Select
          value={filters.categoryId ?? ALL_VALUE}
          onValueChange={(value) => onChange({ ...filters, categoryId: value === ALL_VALUE ? undefined : value })}
        >
          <SelectTrigger id="filter-report-category" data-testid="filter-report-category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All categories</SelectItem>
            {categories?.data.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-report-type">Type</Label>
        <Select
          value={filters.type ?? ALL_VALUE}
          onValueChange={(value) =>
            onChange({ ...filters, type: value === ALL_VALUE ? undefined : (value as ReportFilters["type"]), categoryId: undefined })
          }
        >
          <SelectTrigger id="filter-report-type" data-testid="filter-report-type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All types</SelectItem>
            {TRANSACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "income" ? "Income" : "Expense"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2" data-testid="filter-report-date-range">
        <Label htmlFor="filter-report-from">From</Label>
        <Input
          id="filter-report-from"
          type="date"
          value={filters.from ?? ""}
          onChange={(e) => onChange({ ...filters, from: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="filter-report-to">To</Label>
        <Input
          id="filter-report-to"
          type="date"
          value={filters.to ?? ""}
          onChange={(e) => onChange({ ...filters, to: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}
