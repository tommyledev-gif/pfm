import { useEffect, useRef, useState } from "react";
import { Keyboard } from "react-native";

import { DrawerChild } from "@/components/shared/Drawer";
import { MapPinIcon } from "@/components/ui/Icon";
import { PillButton } from "@/components/ui/PillButton";
import { useColors } from "@/lib/theme";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { TransactionLocationInput } from "@/features/transactions/types";
import { captureCurrentLocation, Coordinates, LocationFailure } from "@/features/transactions/location/capture-location";
import { resolvePlaceName } from "@/features/transactions/location/place-name";
import {
  LocationStepMode,
  LocationStepStatus,
  TransactionLocationPanel,
} from "@/features/transactions/components/TransactionLocationPanel";

// "save": opened by the form's save, and its own button books the
// Transaction. "adjust": reopened from the form to look at or move the pin,
// and it only hands the pin back. "saved": a saved Transaction's own pin —
// it can be moved (the form's PATCH carries it) but never removed.
export type LocationStepIntent = "save" | "adjust" | "saved";

interface UseLocationStepOptions {
  // The host sheet's own visibility: closing the sheet from under an open
  // step (a tap on the backdrop above it) must not leave the step open for
  // the next time the sheet opens.
  sheetVisible: boolean;
  // The pin the User confirmed, or null for no location after all.
  onConfirm: (location: TransactionLocationInput | null, intent: LocationStepIntent) => void;
}

/**
 * The "Ghim vị trí" step a create goes through on save while its location
 * switch is on: take a GPS fix (asking for the permission and for location
 * services first), show it pinned on the map with the area's name, and let
 * the User nudge the pin and add a note about the place. Same hook-returns-a-
 * DrawerChild shape as useCategoryPicker, so the form's sheet stays mounted
 * underneath.
 *
 * A pin that already exists (reopened in this sheet, or a saved Transaction's)
 * opens in view mode: the full map to pan around, the area and the note, and
 * a "Sửa vị trí" button — nothing moves by accident while just looking.
 */
export function useLocationStep({ sheetVisible, onConfirm }: UseLocationStepOptions) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<LocationStepStatus>("locating");
  const [failure, setFailure] = useState<LocationFailure>("unavailable");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [fixId, setFixId] = useState(0);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [naming, setNaming] = useState(false);
  const [note, setNote] = useState("");
  const [intent, setIntent] = useState<LocationStepIntent>("save");
  // A pin that already exists opens to look at, not to edit — only a pin
  // being taken for the first time starts editable (see open below).
  const [mode, setMode] = useState<LocationStepMode>("edit");
  // What the step opened with, so "Huỷ" can put a saved pin back.
  const original = useRef<TransactionLocationInput | null>(null);
  const colors = useColors();
  // Bumped by whatever makes an in-flight lookup stale — closing, a retry, a
  // moved pin — so a late answer never lands on a pin it was not asked about.
  const generation = useRef(0);
  const confirmLatest = useLatestCallback(onConfirm);

  const name = async (at: Coordinates, gen: number) => {
    setNaming(true);
    const label = await resolvePlaceName(at);
    if (gen !== generation.current) return;
    setPlaceName(label);
    setNaming(false);
  };

  const pin = (at: Coordinates, label: string | null) => {
    setCoords(at);
    setFixId((id) => id + 1);
    setStatus("ready");
    setPlaceName(label);
    setNaming(false);
  };

  const locate = async () => {
    const gen = ++generation.current;
    setStatus("locating");
    setCoords(null);
    const result = await captureCurrentLocation();
    if (gen !== generation.current) return;
    if (!result.ok) {
      setFailure(result.reason);
      setStatus("failed");
      return;
    }
    pin(result.coords, null);
    void name(result.coords, gen);
  };

  // `seed` reopens a pin already confirmed in this sheet (or kept on a queued
  // item) instead of taking a new fix.
  const open = (seed: TransactionLocationInput | null, nextIntent: LocationStepIntent) => {
    setIntent(nextIntent);
    setMode(seed && nextIntent !== "save" ? "view" : "edit");
    original.current = seed;
    setVisible(true);
    setNote(seed?.note ?? "");
    if (!seed) {
      void locate();
      return;
    }
    const gen = ++generation.current;
    const at = { latitude: seed.latitude, longitude: seed.longitude };
    pin(at, seed.place_name ?? null);
    // Pinned offline: the network may be back to name it now.
    if (!seed.place_name) void name(at, gen);
  };

  const movePin = (at: Coordinates) => {
    const gen = ++generation.current;
    setCoords(at);
    void name(at, gen);
  };

  // "Huỷ" in a saved pin's edit mode: back to exactly what was saved, and
  // recentred on it (a new fixId remounts the map at the pin).
  const cancelEdit = () => {
    const seed = original.current;
    if (seed) {
      generation.current += 1;
      pin({ latitude: seed.latitude, longitude: seed.longitude }, seed.place_name ?? null);
      setNote(seed.note ?? "");
    }
    Keyboard.dismiss();
    setMode("view");
  };

  const close = () => {
    generation.current += 1;
    setNaming(false);
    setVisible(false);
  };

  useEffect(() => {
    if (sheetVisible) return;
    generation.current += 1;
    setVisible(false);
  }, [sheetVisible]);

  const confirm = () => {
    if (!coords) return;
    Keyboard.dismiss();
    close();
    confirmLatest({ ...coords, place_name: placeName ?? undefined, note: note.trim() || undefined }, intent);
  };

  const skip = () => {
    Keyboard.dismiss();
    close();
    confirmLatest(null, intent);
  };

  const viewing = mode === "view";
  const footer = viewing ? (
    <>
      <PillButton label="Đóng" variant="outline" onPress={close} style={{ flex: 1 }} testID="btn-location-close" />
      <PillButton
        label="Sửa vị trí"
        icon={<MapPinIcon size={16} color={colors.onGreen} />}
        onPress={() => setMode("edit")}
        disabled={status !== "ready"}
        style={{ flex: 1 }}
        testID="btn-location-edit"
      />
    </>
  ) : (
    <>
      <PillButton
        label={intent === "save" ? "Lưu không kèm vị trí" : intent === "saved" ? "Huỷ" : "Bỏ ghim"}
        variant="outline"
        onPress={intent === "saved" ? cancelEdit : skip}
        style={{ flex: 1 }}
        testID="btn-location-skip"
      />
      <PillButton
        label={intent === "save" ? "Lưu" : "Xong"}
        onPress={confirm}
        // Waits for the area's name, which resolvePlaceName caps in time.
        disabled={status !== "ready" || naming}
        loading={naming}
        style={{ flex: 1 }}
        testID="btn-location-confirm"
      />
    </>
  );

  const child: DrawerChild = {
    visible,
    onClose: close,
    title: viewing ? "Vị trí giao dịch" : "Ghim vị trí",
    children: (
      <TransactionLocationPanel
        status={status}
        mode={mode}
        failure={failure}
        coords={coords}
        fixId={fixId}
        placeName={placeName}
        naming={naming}
        note={note}
        onChangeNote={setNote}
        onMovePin={movePin}
        onRetry={() => void locate()}
      />
    ),
    footer,
  };

  return { child, open };
}
