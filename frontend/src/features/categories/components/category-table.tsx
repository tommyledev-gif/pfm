import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteCategoryDialog } from "@/features/categories/components/delete-category-dialog";
import { EditCategoryDialog } from "@/features/categories/components/edit-category-dialog";
import { ROUTES } from "@/lib/constants";
import type { Category } from "@/features/categories/types";

interface CategoryTableProps {
  categories: Category[];
}

export function CategoryTable({ categories }: CategoryTableProps) {
  if (categories.length === 0) {
    return (
      <p data-testid="text-categories-empty" className="py-8 text-center text-sm text-muted-foreground">
        No categories yet — create one to classify your transactions.
      </p>
    );
  }

  return (
    <Table data-testid="table-categories">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => {
          const isSystem = category.user_id === null;
          return (
            <TableRow key={category.id}>
              <TableCell className="font-medium">
                <Link href={`${ROUTES.categories}/${category.id}`} className="hover:underline">
                  {category.icon && <span className="mr-2">{category.icon}</span>}
                  {category.name}
                </Link>
              </TableCell>
              <TableCell className="capitalize">{category.type}</TableCell>
              <TableCell>
                {isSystem && (
                  <Badge data-testid="badge-category-system" variant="secondary">
                    System
                  </Badge>
                )}
              </TableCell>
              <TableCell className="flex justify-end gap-2">
                <Button asChild variant="ghost" size="sm" data-testid="btn-view-category">
                  <Link href={`${ROUTES.categories}/${category.id}`}>View</Link>
                </Button>
                {!isSystem && (
                  <>
                    <EditCategoryDialog category={category} />
                    <DeleteCategoryDialog category={category} />
                  </>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
