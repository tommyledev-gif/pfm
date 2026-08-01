"use client";

import { ErrorBanner } from "@/components/shared/error-banner";
import { PageHeader } from "@/components/shared/page-header";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { CategoryTable } from "@/features/categories/components/category-table";
import { CategoryTableSkeleton } from "@/features/categories/components/category-table-skeleton";
import { CreateCategoryDialog } from "@/features/categories/components/create-category-dialog";

export default function CategoriesPage() {
  const { data, isLoading, isError } = useCategoriesQuery();

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Classify income and expense transactions — system defaults plus your own."
        actions={<CreateCategoryDialog />}
      />

      {isError && <ErrorBanner message="Failed to load categories." />}
      {isLoading && <CategoryTableSkeleton />}
      {!isLoading && data && <CategoryTable categories={data.data} />}
    </div>
  );
}
