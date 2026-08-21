import { useEffect } from "react";
import { usePathname } from "expo-router";

import { useDebugLogStore } from "@/stores/debug-log-store";

// Invisible — mounted once in app/_layout.tsx above the Stack
// (specs/mobile-debug-console/spec.md decision #4). Appends one log entry
// per route change so the debug console can answer "which screen was the
// user on."
export function NavigationLogger() {
  const pathname = usePathname();
  const append = useDebugLogStore((s) => s.append);

  useEffect(() => {
    append("navigation", `→ ${pathname}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
