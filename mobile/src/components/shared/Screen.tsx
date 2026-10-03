import { ReactNode } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { Edge, SafeAreaView } from "react-native-safe-area-context";

import { useColors } from "@/lib/theme";

interface ScreenProps {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}

// Every (app) screen was rendering straight into the root View with no
// safe-area handling, so headers/content sat under the status bar. Bottom
// edge is deliberately excluded by default — BottomNav already reserves
// `insets.bottom` itself, and screens' own bottom padding accounts for it.
export function Screen({ children, edges = ["top"], style }: ScreenProps) {
  const colors = useColors();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bgApp }, style]}>
      {children}
    </SafeAreaView>
  );
}
