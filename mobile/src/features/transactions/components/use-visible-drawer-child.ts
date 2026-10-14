import { useState } from "react";

import { DrawerChild } from "@/components/shared/Drawer";

/**
 * A Drawer has one child slot; this shares it between panels owned by
 * different hooks (the form's own panels, the wallet pickers). The open one
 * takes the slot; once it closes it keeps the slot, so it can slide out with
 * its own content, until another one opens.
 */
export function useVisibleDrawerChild(children: DrawerChild[]): DrawerChild | undefined {
  const [last, setLast] = useState(0);
  const open = children.findIndex((child) => child.visible);
  // Adjusted during render, React's pattern for derived state.
  if (open >= 0 && open !== last) setLast(open);
  return children[open >= 0 ? open : last];
}
