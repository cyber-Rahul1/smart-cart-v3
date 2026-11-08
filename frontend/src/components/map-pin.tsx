import { StyleSheet, View } from "react-native";

import { useTheme } from "@/src/theme";
import { Ionicons } from "@/src/ui";

/** Fixed pin over the map centre: the user drags the map underneath it to choose a spot. */
export function CenterPin() {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]} testID="map-center-pin">
      <View style={{ alignItems: "center", marginBottom: 40 }}>
        <Ionicons name="location" size={44} color={colors.brandPrimary} />
        <View style={{ width: 10, height: 4, borderRadius: 2, backgroundColor: colors.scrim, marginTop: -4 }} />
      </View>
    </View>
  );
}
