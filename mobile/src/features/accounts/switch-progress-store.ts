import { create } from "zustand";

// True while a switch / add-account commit is running. Read by the
// app-wide BusyOverlay in app/_layout.tsx (AC-12, EC-07): the switch can
// start on Settings or on the login screen, so the overlay lives above both.
interface SwitchProgressState {
  switching: boolean;
  setSwitching: (switching: boolean) => void;
}

export const useSwitchProgressStore = create<SwitchProgressState>((set) => ({
  switching: false,
  setSwitching: (switching) => set({ switching }),
}));
