"use client";

import { useParams } from "next/navigation";

import { ErrorBanner } from "@/components/shared/error-banner";
import { PageHeader } from "@/components/shared/page-header";
import { useCategoryQuery } from "@/features/categories/api/use-category-query";
import { CategoryDetailCard } from "@/features/categories/components/category-detail-card";
import { CategoryDetailCardSkeleton } from "@/features/categories/components/category-detail-card-skeleton";

export default function CategoryDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading, isError } = useCategoryQuery(params.id);

  return (
    <div>
      <PageHeader title="Category details" />

      {isError && (
        <ErrorBanner message="Failed to load this category — it may not exist or you may not have access to it." />
      )}
      {isLoading && <CategoryDetailCardSkeleton />}
      {!isLoading && data && <CategoryDetailCard category={data} />}
    </div>
  );
}
