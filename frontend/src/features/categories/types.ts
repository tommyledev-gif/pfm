import type { CategoryType } from "@/lib/constants";

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  icon: string | null;
  type: CategoryType;
  created_at: string;
}

export interface ListCategoriesResult {
  data: Category[];
}

export interface CreateCategoryRequest {
  name: string;
  icon?: string;
  type: CategoryType;
}

export interface UpdateCategoryRequest {
  name?: string;
  icon?: string;
}
