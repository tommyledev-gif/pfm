import { useState } from "react";

import { DrawerChild } from "@/components/shared/Drawer";

/**
 * A transaction sheet has one child slot. Whichever panel opened last keeps
 * it, so a panel sliding back out keeps its own content until it is gone.
 * Callers call `claim(name)` right before opening that panel. The full form
 * has category, location and items panels; the AI chat's edit sheet only
 * category and items.
 */
export function useFormDrawerChild<P extends Record<string, DrawerChild>>(panels: P, initial: keyof P) {
  const [active, setActive] = useState<keyof P>(initial);
  return { drawerChild: panels[active], claim: setActive };
}
