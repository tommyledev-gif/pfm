import { useDebugLogStore } from "@/stores/debug-log-store";

// ErrorUtils is a React Native global (no import needed) — installed once
// from app/_layout.tsx. Always forwards to the previous handler; never
// suppresses the real crash behavior (specs/mobile-debug-console/spec.md
// decision #5 / Main Flow step 2c).
export function installGlobalErrorLogger(): void {
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
      setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
    };
  };
  if (!g.ErrorUtils) return;

  const previousHandler = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    useDebugLogStore.getState().append("error", error.message || "Unknown error", {
      stack: error.stack,
      isFatal,
    });
    previousHandler(error, isFatal);
  });
}
