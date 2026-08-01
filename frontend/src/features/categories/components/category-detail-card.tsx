"use client";

import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteCategoryDialog } from "@/features/categories/components/delete-category-dialog";
import { EditCategoryDialog } from "@/features/categories/components/edit-category-dialog";
import type { Category } from "@/features/categories/types";
import { ROUTES } from "@/lib/constants";

interface CategoryDetailCardProps {
  category: Category;
}

export function CategoryDetailCard({ category }: CategoryDetailCardProps) {
  const router = useRouter();
  const isSystem = category.user_id === null;

  return (
    <Card data-testid="card-category-detail">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {category.icon && <span>{category.icon}</span>}
          <CardTitle>{category.name}</CardTitle>
          {isSystem && (
            <Badge data-testid="badge-category-system" variant="secondary">
              System
            </Badge>
          )}
        </div>
        {!isSystem && (
          <div className="flex items-center gap-2">
            <EditCategoryDialog category={category} />
            <DeleteCategoryDialog category={category} onDeleted={() => router.push(ROUTES.categories)} />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Type</dt>
          <dd className="capitalize">{category.type}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
