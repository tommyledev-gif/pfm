import { CategoryType } from "@/lib/constants";

// Mirrors backend/internal/dto/category_response.go. No `color` field exists
// server-side — icon-circle colors are derived client-side, see
// src/lib/category-color.ts.
export interface Category {
  id: string;
  user_id: string | null; // null = system default category
  name: string;
  icon: string | null;
  type: CategoryType;
  created_at: string;
}
