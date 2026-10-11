import { useState } from "react";

import { DrawerChild } from "@/components/shared/Drawer";

type ChildName = "category" | "location" | "items";

/**
 * The Transaction sheet has one child slot. Whichever panel opened last keeps
 * it, so a panel sliding back out keeps its own content until it is gone.
 * Callers call `claim(name)` right before opening that panel.
 */
export function useFormDrawerChild(panels: Record<ChildName, DrawerChild>) {
  const [active, setActive] = useState<ChildName>("category");
  return { drawerChild: panels[active], claim: setActive };
}
