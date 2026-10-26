import { Keyboard } from "react-native";

// For anything that opens a Modal over the composer: close the keyboard
// first. A Modal is its own Android window; it hides the keyboard but leaves
// the input focused, and the input bar stayed lifted under the overlay.
export const dismissKeyboardThen =
  <A extends unknown[]>(open: (...args: A) => void) =>
  (...args: A) => {
    Keyboard.dismiss();
    open(...args);
  };
