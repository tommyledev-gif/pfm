import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Edge, SafeAreaView } from "react-native-safe-area-context";

import { OfflineBanner } from "@/components/shared/OfflineBanner";
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
//
// Also the one place the offline strip lives: right under the status bar,
// full width, pushing the screen down. That is why `style` goes on an inner
// view — a screen's own padding must not inset the strip.
const TOP_EDGE: Edge[] = ["top"];

export function Screen({ children, edges = TOP_EDGE, style }: ScreenProps) {
  const colors = useColors();
  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: colors.bgApp }]}>
      {edges.includes("top") ? <OfflineBanner /> : null}
      <View style={[styles.fill, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
