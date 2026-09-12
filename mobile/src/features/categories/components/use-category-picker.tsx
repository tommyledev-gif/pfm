import { useCallback, useMemo, useState } from "react";

import { DrawerChild } from "@/components/shared/Drawer";
import { PillButton } from "@/components/ui/PillButton";
import { CategoryPickerList } from "@/features/categories/components/CategoryPickerList";
import { Category } from "@/features/categories/types";

interface UseCategoryPickerOptions {
  categories: Category[];
  // Always an array, even for the single-select hosts — one shape covers both
  // modes, and a single-select caller just reads `ids[0]` back out.
  selectedIds: string[];
  onApply: (ids: string[]) => void;
  multiple?: boolean;
  title?: string;
}

// Wires a category field to a Drawer child panel: hand `child` to the Drawer
// and render a CategorySelectField driven by `selected` / `open`.
//
// A hook rather than a component because the two halves live in different
// places in the host's tree — the field sits inside the sheet's scrolling
// body, the panel has to be a prop on the Drawer itself (see DrawerChild) —
// and both have to share one draft selection.
//
// Selection is a draft: nothing reaches `onApply` until the footer's confirm
// is pressed, so backing out of the panel leaves the form exactly as it was.
export function useCategoryPicker({
  categories,
  selectedIds,
  onApply,
  multiple = false,
  title = "Chọn danh mục",
}: UseCategoryPickerOptions) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<string[]>(selectedIds);

  // No effect resyncs `draft` from `selectedIds` — open() below already seeds
  // it at the only moment it matters, and an effect doing the same job was an
  // infinite render loop: callers build `selectedIds` inline (`categoryId ?
  // [categoryId] : []`), so it is a fresh array on every render, the dep
  // comparison never matched, and each setDraft scheduled the render that
  // re-ran it ("Maximum update depth exceeded" on every screen hosting a
  // transaction form).
  const open = useCallback(() => {
    setDraft(selectedIds);
    setVisible(true);
  }, [selectedIds]);

  const close = useCallback(() => setVisible(false), []);

  const toggle = useCallback(
    (id: string) => {
      setDraft((prev) => {
        if (!multiple) return prev.includes(id) ? [] : [id];
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      });
    },
    [multiple],
  );

  const confirm = useCallback(() => {
    onApply(draft);
    setVisible(false);
  }, [draft, onApply]);

  const selected = useMemo(
    () => categories.filter((c) => selectedIds.includes(c.id)),
    [categories, selectedIds],
  );

  const child: DrawerChild = {
    visible,
    onClose: close,
    title,
    children: (
      <CategoryPickerList categories={categories} selectedIds={draft} onToggle={toggle} multiple={multiple} />
    ),
    footer: (
      <>
        <PillButton label="Bỏ chọn" variant="outline" onPress={() => setDraft([])} style={{ flex: 1 }} />
        <PillButton
          label={multiple && draft.length > 0 ? `Chọn (${draft.length})` : "Chọn"}
          onPress={confirm}
          disabled={draft.length === 0}
          style={{ flex: 1 }}
          testID="btn-category-picker-confirm"
        />
      </>
    ),
  };

  return { child, open, selected };
}
