import { Image, Text, View } from "react-native";

import { createStyles } from "@/lib/theme";

const LOGO = require("../../../../assets/icon.png");
const LOGO_SIZE = 40;

/** The auth screens' brand row: app logo on the left, "Budgest" on the right. */
export function BrandMark() {
  const styles = useStyles();
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Budgest">
      <Image source={LOGO} style={styles.logo} accessibilityIgnoresInvertColors />
      <Text style={styles.word}>Budgest</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: 10 },
  word: { fontSize: 22, fontWeight: "700", letterSpacing: -0.2, color: colors.textPrimary },
}));
