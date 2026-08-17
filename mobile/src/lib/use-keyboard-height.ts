import { useEffect, useState } from "react";
import { Keyboard, LayoutAnimation, Platform, UIManager } from "react-native";

// Pre-Fabric Android silently no-ops LayoutAnimation without this opt-in;
// guarded since the API isn't guaranteed present under the new architecture.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// iOS fires "will" events before the keyboard animation starts (letting UI
// animate in step with it); Android only reliably fires "did" events.
const SHOW_EVENT = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
const HIDE_EVENT = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

// Returns the live keyboard height in px (0 when hidden) instead of just a
// boolean, so callers can push content up by exactly that amount using
// plain flex/margin math — deliberately not KeyboardAvoidingView, whose
// Android "height" behavior has a long-standing bug where it fails to
// restore the original layout once the keyboard closes (facebook/react-
// native#22884 and friends), which is exactly the "stuck pushed up after
// closing the keyboard" symptom this replaced.
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(SHOW_EVENT, (e) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(HIDE_EVENT, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
