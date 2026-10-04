import { useEffect, useState, type ReactNode } from "react";
import { IsRestoringProvider } from "@tanstack/react-query";

import { attachQueryPersistence } from "@/lib/query-persistence/query-persistence";
import { useCurrentUserId } from "@/stores/use-current-user-id";

interface UserScopedQueryPersistenceProps {
  children: ReactNode;
}

/**
 * Attaches the signed-in User's saved cache (specs/mobile-offline-support
 * US-03). While it is being read, queries are told "restoring" so they
 * neither fetch nor settle into an empty state that the restore would then
 * overwrite. Detaching is session-store's job, because it must happen before
 * the cache is cleared — this component only attaches.
 */
export function UserScopedQueryPersistence({ children }: UserScopedQueryPersistenceProps) {
  const userId = useCurrentUserId();
  // The User whose restore has finished. Compared during render, so the very
  // first render after a User change is already "restoring" — no frame can
  // fetch or show an empty state ahead of the restore.
  const [restoredFor, setRestoredFor] = useState<string | null>(null);

  const isRestoring = userId !== null && restoredFor !== userId;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    attachQueryPersistence(userId).then(() => {
      if (!cancelled) setRestoredFor(userId);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return <IsRestoringProvider value={isRestoring}>{children}</IsRestoringProvider>;
}
