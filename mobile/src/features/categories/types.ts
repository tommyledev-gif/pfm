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
  // icon_url is an uploaded custom image (Cloudflare R2) — takes display
  // priority over `icon`'s free-text emoji when present.
  icon_url: string | null;
  // system_key is the stable identifier for a system-defined category. null for
  // a user's own. The budget wizard's presets resolve through this rather than
  // through `name`, which changes with renames and with language.
  system_key: string | null;
}
